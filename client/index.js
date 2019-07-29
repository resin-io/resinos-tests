const Bluebird = require('bluebird');
const { emptyDir } = require('fs-extra');
const md5 = require('md5-file/promise');
const { fs, crypto } = require('mz');
const { tmpdir, constants } = require('os');
const { basename, dirname, join } = require('path');
const progStream = require('progress-stream');
const tar = require('tar-fs');
const rp = require('request-promise');
const { Spinner, Progress } = require('resin-cli-visuals');
const pipeline = Bluebird.promisify(require('stream').pipeline);
const websocket = require('websocket-stream');
const zlib = require('zlib');

const yargs = require('yargs')
  .usage('Usage: $0 [options]')
  .option('h', {
    alias: 'help',
    description: 'display help message',
  })
  .option('s', {
    alias: 'suite',
    description: 'path to test suite',
    type: 'string',
  })
  .option('i', {
    alias: 'image',
    description: 'path to unconfigured OS image',
    type: 'string',
  })
  .option('c', {
    alias: 'config',
    description: 'path to configuration file',
    type: 'string',
  })
  .option('w', {
    alias: 'workdir',
    description: 'working directory',
    type: 'string',
    default: `${tmpdir()}/run`,
  })
  .option('u', {
    alias: 'url',
    description: 'Leviathan url',
    type: 'string',
    default: 'localhost',
  })
  .version()
  .help('help')
  .showHelpOnFail(false, 'Something went wrong! run with --help').argv;

async function isGzip(filePath) {
  const buf = Buffer.alloc(3);

  await fs.read(await fs.open(filePath, 'r'), buf, 0, 3, 0);

  return buf[0] === 0x1f && buf[1] === 0x8b && buf[2] === 0x08;
}

async function getFilesFromDirectory(basePath, ignore = []) {
  let files = [];
  const entries = await fs.readdir(basePath);

  for (const entry of entries) {
    if (ignore.includes(entry)) {
      continue;
    }

    const stat = await fs.stat(join(basePath, entry));

    if (stat.isFile()) {
      files.push(join(basePath, entry));
    }

    if (stat.isDirectory()) {
      files = files.concat(
        await getFilesFromDirectory(join(basePath, entry), ignore),
      );
    }
  }

  return files;
}

(async () => {
  await emptyDir(yargs.workdir);

  const ignore = ['node_modules', 'package-lock.json'];
  const artifacts = [
    { path: yargs.suite, type: 'isDirectory', name: 'suite' },
    { path: yargs.config, type: 'isFile', name: 'config.json' },
    { path: yargs.image, type: 'isFile', name: 'image' },
  ];

  for (let artifact of artifacts) {
    const stat = await fs.stat(artifact.path);

    if (!stat[artifact.type]()) {
      throw new Error(`${artifact.path} does not satisfy ${artifcat.type}`);
    }

    if (artifact.name === 'image') {
      const bar = new Progress('Gzipping Image');
      const str = progStream({
        length: stat.size,
        time: 100,
      });
      str.on('progress', progress => {
        bar.update({
          percentage: progress.percentage,
          eta: progress.eta,
        });
      });
      if (!(await isGzip(artifact.path))) {
        const gzippedPath = join(yargs.workdir, artifact.name);

        await pipeline(
          fs.createReadStream(artifact.path),
          str,
          zlib.createGzip({ level: 6 }),
          fs.createWriteStream(gzippedPath),
        );

        artifact.path = gzippedPath;
      }
    }
  }

  // Upload with cache check in place
  for (const artifact of artifacts) {
    console.log(`Handling artifcat: ${artifact.path}`);
    const spinner = new Spinner('Calculating hash');
    let hash = null;

    spinner.start();
    if (artifact.type === 'isDirectory') {
      const struct = await getFilesFromDirectory(artifact.path, ignore);

      const expand = await Promise.all(
        struct.map(async entry => {
          return {
            path: entry.replace(
              join(artifact.path, '/'),
              join(artifact.name, '/'),
            ),
            md5: await md5(entry),
          };
        }),
      );
      expand.sort((a, b) => {
        const splitA = a.path.split('/');
        const splitB = b.path.split('/');
        return splitA.every((sub, i) => {
          return sub <= splitB[i];
        })
          ? -1
          : 1;
      });
      hash = crypto
        .Hash('md5')
        .update(
          expand.reduce((acc, value) => {
            return acc + value.md5;
          }, ''),
        )
        .digest('hex');
    }
    if (artifact.type === 'isFile') {
      hash = await md5(artifact.path);
    }
    spinner.stop();

    await new Promise(async (resolve, reject) => {
      const stat = await fs.stat(artifact.path);
      const str = progStream({
        length: stat.size,
        time: 100,
      });
      const bar = new Progress('Uploading');
      str.on('progress', progress => {
        bar.update({
          percentage: progress.percentage,
          eta: progress.eta,
        });
      });

      const req = rp.post({
        uri: `http://${yargs.url}/upload`,
        headers: {
          'x-artifact': artifact.name,
          'x-artifact-hash': hash,
        },
      });

      req.finally(() => {
        resolve();
      });
      req.on('error', reject);
      req.on('data', async data => {
        const computedLine = RegExp('^([a-z]*): (.*)').exec(data.toString());

        if (computedLine[1] === 'error') {
          req.cancel();
          reject(new Error(computedLine[2]));
        }

        if (computedLine[1] === 'upload') {
          if (computedLine[2] === 'cache') {
            console.log('[Cache used]');
            resolve();
          }

          if (computedLine[2] === 'done') {
            resolve();
          }
        }
      });

      await pipeline(
        tar.pack(dirname(artifact.path), {
          ignore: function(name) {
            return ignore.some(value => {
              const re = new RegExp(`.*${value}.*`);
              return re.test(name);
            });
          },
          map: function(header) {
            header.name = header.name.replace(
              basename(artifact.path),
              artifact.name,
            );
            return header;
          },
          entries: [basename(artifact.path)],
        }),
        str,
        zlib.createGzip({ level: 6 }),
        req,
      ).delay(1000);
    });
  }

  const ws = websocket(`ws://${yargs.url}/start`);
  // Keep the websocket alive
  ws.socket.on('ping', () => {
    ws.socket.pong('heartbeat');
  });
  process.on('SIGINT', async () => {
    await rp.post(`http://${yargs.url}/stop`);
    process.exit(128 + constants.signals.SIGINT);
  });
  process.stdin.pipe(ws);
  ws.pipe(process.stdout);
})();
