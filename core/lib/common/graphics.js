/**
 * # Screen Capture
 *
 * If screen capture is supported and appropriate hardware is attached, the video output of the DUT
 * can be captured. For the testbot, this requires a compatible video capture device to be connected
 * that works with v4L2 and enumerates on the `/dev/video0` interface. If that is the case, then
 * capture can be started using the `Worker` class `capture()` method, for example:
 *
 * @example
 * ```js
 * const Worker = this.require('common/worker');
 * const worker = new Worker('DEVICE_TYPE_SLUG', this.getLogger())
 * await worker.capture('start');
 * ```
 *
 * This will trigger video capture to start, and frames will be saved as `jpg` files in the `/data/capture` directory (which is a shared volume). Capture will continue until stopped with:
 *
 * ```js
 * await worker.capture('stop');
 * ```
 *
 * @module Graphics
 */

/*
 * Copyright 2019 balena
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

function median(data) {
	const mdarr = data.slice(0);
	mdarr.sort(function(a, b) {
		return a - b;
	});
	if (mdarr.length % 2 === 0) {
		return (mdarr[mdarr.length / 2 - 1] + mdarr[mdarr.length / 2]) / 2.0;
	}
	return mdarr[Math.floor(mdarr.length / 2)];
}

function translateBlocksToBits(blocks, pixelsPerBlock) {
	let halfBlockValue = (pixelsPerBlock * 256 * 3) / 2;
	let bandSize = blocks.length / 4;

	// Compare medians across four horizontal bands
	for (let i = 0; i < 4; i++) {
		const m = median(blocks.slice(i * bandSize, (i + 1) * bandSize));
		for (let j = i * bandSize; j < (i + 1) * bandSize; j++) {
			const v = blocks[j];

			// Output a 1 if the block is brighter than the median.
			// With images dominated by black or white, the median may
			// end up being 0 or the max value, and thus having a lot
			// of blocks of value equal to the median.  To avoid
			// generating hashes of all zeros or ones, in that case output
			// 0 if the median is in the lower value space, 1 otherwise
			blocks[j] = Number(v > m || (Math.abs(v - m) < 1 && m > halfBlockValue));
		}
	}
}

function bitsToHexhash(bitsArray) {
	const hex = [];
	for (let i = 0; i < bitsArray.length; i += 4) {
		const nibble = bitsArray.slice(i, i + 4);
		hex.push(parseInt(nibble.join(''), 2).toString(16));
	}

	return hex.join('');
}

function bmvbHashEven(data, bits) {
	let blockSizeX = Math.floor(data.width / bits);
	let blockSizeY = Math.floor(data.height / bits);

	const result = [];

	for (let y = 0; y < bits; y++) {
		for (let x = 0; x < bits; x++) {
			let total = 0;

			for (let iy = 0; iy < blockSizeY; iy++) {
				for (let ix = 0; ix < blockSizeX; ix++) {
					const cx = x * blockSizeX + ix;
					const cy = y * blockSizeY + iy;
					const ii = (cy * data.width + cx) * 4;

					var alpha = data.data[ii + 3];
					if (alpha === 0) {
						total += 765;
					} else {
						total += data.data[ii] + data.data[ii + 1] + data.data[ii + 2];
					}
				}
			}

			result.push(total);
		}
	}

	translateBlocksToBits(result, blockSizeX * blockSizeY);
	return bitsToHexhash(result);
}

// Bit sequence to calculate hamming distance
const oneBits = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

module.exports = {
	hammingDistance: function(hashA, hashB) {
		let d = 0;

		if (hashA.length !== hashB.length) {
			throw new Error("Can't compare hashes with different length");
		}

		for (let i = 0; i < hashA.length; i++) {
			var n1 = parseInt(hashA[i], 16);
			var n2 = parseInt(hashB[i], 16);
			d += oneBits[n1 ^ n2];
		}
		return d;
	},
	// This is a perceptual image hash calculation tool based on algorithm descibed
	// in Block Mean Value Based Image Perceptual Hashing by Bian Yang, Fan Gu and Xiamu Niu.
	blockhash: function(data, bits = 8) {
		const result = [];

		let weightTop, weightBottom, weightLeft, weightRight;
		let blockTop, blockBottom, blockLeft, blockRight;
		let yMod, yFrac, yInt;
		let xMod, xFrac, xInt;
		let blocks = [];

		const evenX = data.width % bits === 0;
		const evenY = data.height % bits === 0;

		if (evenX && evenY) {
			return bmvbHashEven(data, bits);
		}

		// initialize blocks array with 0s
		for (let i = 0; i < bits; i++) {
			blocks.push([]);
			for (let j = 0; j < bits; j++) {
				blocks[i].push(0);
			}
		}

		const blockWidth = data.width / bits;
		const blockHeight = data.height / bits;

		for (let y = 0; y < data.height; y++) {
			if (evenY) {
				// don't bother dividing y, if the size evenly divides by bits
				blockTop = blockBottom = Math.floor(y / blockHeight);
				weightTop = 1;
				weightBottom = 0;
			} else {
				yMod = (y + 1) % blockHeight;
				yFrac = yMod - Math.floor(yMod);
				yInt = yMod - yFrac;

				weightTop = 1 - yFrac;
				weightBottom = yFrac;

				// y_int will be 0 on bottom/right borders and on block boundaries
				if (yInt > 0 || y + 1 === data.height) {
					blockTop = blockBottom = Math.floor(y / blockHeight);
				} else {
					blockTop = Math.floor(y / blockHeight);
					blockBottom = Math.ceil(y / blockHeight);
				}
			}

			for (let x = 0; x < data.width; x++) {
				const ii = (y * data.width + x) * 4;

				let avgValue;
				let alpha = data.data[ii + 3];
				if (alpha === 0) {
					avgValue = 765;
				} else {
					avgValue = data.data[ii] + data.data[ii + 1] + data.data[ii + 2];
				}

				if (evenX) {
					blockLeft = blockRight = Math.floor(x / blockWidth);
					weightLeft = 1;
					weightRight = 0;
				} else {
					xMod = (x + 1) % blockWidth;
					xFrac = xMod - Math.floor(xMod);
					xInt = xMod - xFrac;

					weightLeft = 1 - xFrac;
					weightRight = xFrac;

					// x_int will be 0 on bottom/right borders and on block boundaries
					if (xInt > 0 || x + 1 === data.width) {
						blockLeft = blockRight = Math.floor(x / blockWidth);
					} else {
						blockLeft = Math.floor(x / blockWidth);
						blockRight = Math.ceil(x / blockWidth);
					}
				}

				// add weighted pixel value to relevant blocks
				blocks[blockTop][blockLeft] += avgValue * weightTop * weightLeft;
				blocks[blockTop][blockRight] += avgValue * weightTop * weightRight;
				blocks[blockBottom][blockLeft] += avgValue * weightBottom * weightLeft;
				blocks[blockBottom][blockRight] +=
					avgValue * weightBottom * weightRight;
			}
		}

		for (let i = 0; i < bits; i++) {
			for (let j = 0; j < bits; j++) {
				result.push(blocks[i][j]);
			}
		}

		translateBlocksToBits(result, blockWidth * blockHeight);
		return bitsToHexhash(result);
	},
};
