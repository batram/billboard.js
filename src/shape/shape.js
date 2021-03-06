/**
 * Copyright (c) 2017 ~ present NAVER Corp.
 * billboard.js project is licensed under the MIT license
 */
import {
	curveStepBefore as d3CurveStepBefore,
	curveStepAfter as d3CurveStepAfter,
	curveBasisClosed as d3CurveBasisClosed,
	curveBasisOpen as d3CurveBasisOpen,
	curveBasis as d3CurveBasis,
	curveBundle as d3CurveBundle,
	curveCardinalClosed as d3CurveCardinalClosed,
	curveCardinalOpen as d3CurveCardinalOpen,
	curveCardinal as d3CurveCardinal,
	curveCatmullRomClosed as d3CurveCatmullRomClosed,
	curveCatmullRomOpen as d3CurveCatmullRomOpen,
	curveCatmullRom as d3CurveCatmullRom,
	curveLinearClosed as d3CurveLinearClosed,
	curveLinear as d3CurveLinear,
	curveMonotoneX as d3CurveMonotoneX,
	curveMonotoneY as d3CurveMonotoneY,
	curveNatural as d3CurveNatural,
	curveStep as d3CurveStep
} from "d3-shape";
import {select as d3Select} from "d3-selection";
import CLASS from "../config/classes";
import ChartInternal from "../internals/ChartInternal";
import {extend, isObjectType, isNumber, isUndefined, notEmpty} from "../internals/util";

extend(ChartInternal.prototype, {
	getShapeIndices(typeFilter) {
		const $$ = this;
		const config = $$.config;
		const indices = {};
		let i = 0;

		$$.filterTargetsToShow($$.data.targets
			.filter(typeFilter, $$))
			.forEach(d => {
				for (let j = 0, groups; (groups = config.data_groups[j]); j++) {
					if (groups.indexOf(d.id) < 0) {
						continue;
					}

					for (let k = 0, row; (row = groups[k]); k++) {
						if (row in indices) {
							indices[d.id] = indices[row];
							break;
						}
					}
				}

				if (isUndefined(indices[d.id])) {
					indices[d.id] = i++;
				}
			});

		indices.__max__ = i - 1;

		return indices;
	},

	getShapeX(offset, targetsNum, indices, isSub) {
		const $$ = this;
		const scale = isSub ? $$.subX : ($$.zoomScale || $$.x);
		const barPadding = $$.config.bar_padding;
		const sum = (p, c) => p + c;
		const halfWidth = isObjectType(offset) && offset.total.length ? offset.total.reduce(sum) / 2 : 0;

		return d => {
			const index = d.id in indices ? indices[d.id] : 0;
			let x = 0;

			if (notEmpty(d.x)) {
				const xPos = scale(d.x);

				if (halfWidth) {
					x = xPos - (offset[d.id] || offset.width) +
						offset.total.slice(0, index + 1).reduce(sum) -
						halfWidth;
				} else {
					x = xPos - (isNumber(offset) ? offset : offset.width) * (targetsNum / 2 - index);
				}
			}

			// adjust x position for bar.padding optionq
			if (offset && x && targetsNum > 1 && barPadding) {
				if (index) {
					x += barPadding * index;
				}

				if (targetsNum > 2) {
					x -= (targetsNum - 1) * barPadding / 2;
				} else if (targetsNum === 2) {
					x -= barPadding / 2;
				}
			}

			return x;
		};
	},

	getShapeY(isSub) {
		const $$ = this;
		const isStackNormalized = $$.isStackNormalized();

		return d => (isSub ? $$.getSubYScale(d.id) : $$.getYScale(d.id))(
			isStackNormalized ? $$.getRatio("index", d, true) : d.value
		);
	},

	getShapeOffset(typeFilter, indices, isSub) {
		const $$ = this;
		const targets = $$.orderTargets($$.filterTargetsToShow($$.data.targets.filter(typeFilter, $$)));
		const targetIds = targets.map(t => t.id);

		return (d, idx) => {
			const scale = isSub ? $$.getSubYScale(d.id) : $$.getYScale(d.id);
			const y0 = scale(0);
			let offset = y0;
			let i = idx;

			targets
				.forEach(t => {
					const rowValues = $$.isStepType(d) ? $$.convertValuesToStep(t.values) : t.values;
					const values = rowValues.map(v => ($$.isStackNormalized() ? $$.getRatio("index", v, true) : v.value));

					if (t.id === d.id || indices[t.id] !== indices[d.id]) {
						return;
					}

					if (targetIds.indexOf(t.id) < targetIds.indexOf(d.id)) {
						// check if the x values line up
						if (isUndefined(rowValues[i]) || +rowValues[i].x !== +d.x) { // "+" for timeseries
							// if not, try to find the value that does line up
							i = -1;

							rowValues.forEach((v, j) => {
								const x1 = v.x.constructor === Date ? +v.x : v.x;
								const x2 = d.x.constructor === Date ? +d.x : d.x;

								if (x1 === x2) {
									i = j;
								}
							});
						}

						if (i in rowValues && rowValues[i].value * d.value >= 0) {
							offset += scale(values[i]) - y0;
						}
					}
				});

			return offset;
		};
	},

	isWithinShape(that, d) {
		const $$ = this;
		const shape = d3Select(that);
		let isWithin;

		if (!$$.isTargetToShow(d.id)) {
			isWithin = false;
		} else if ($$.hasValidPointType(that.nodeName)) {
			isWithin = $$.isStepType(d) ?
				$$.isWithinStep(that, $$.getYScale(d.id)(d.value)) :
				$$.isWithinCircle(that, $$.isBubbleType(d) ? $$.pointSelectR(d) * 1.5 : 0);
		} else if (that.nodeName === "path") {
			isWithin = shape.classed(CLASS.bar) ? $$.isWithinBar(that) : true;
		}

		return isWithin;
	},

	getInterpolate(d) {
		const $$ = this;
		const interpolation = $$.getInterpolateType(d);

		return {
			"basis": d3CurveBasis,
			"basis-closed": d3CurveBasisClosed,
			"basis-open": d3CurveBasisOpen,
			"bundle": d3CurveBundle,
			"cardinal": d3CurveCardinal,
			"cardinal-closed": d3CurveCardinalClosed,
			"cardinal-open": d3CurveCardinalOpen,
			"catmull-rom": d3CurveCatmullRom,
			"catmull-rom-closed": d3CurveCatmullRomClosed,
			"catmull-rom-open": d3CurveCatmullRomOpen,
			"monotone-x": d3CurveMonotoneX,
			"monotone-y": d3CurveMonotoneY,
			"natural": d3CurveNatural,
			"linear-closed": d3CurveLinearClosed,
			"linear": d3CurveLinear,
			"step": d3CurveStep,
			"step-after": d3CurveStepAfter,
			"step-before": d3CurveStepBefore
		}[interpolation];
	},

	getInterpolateType(d) {
		const $$ = this;
		const type = $$.config.spline_interpolation_type;
		const interpolation = $$.isInterpolationType(type) ? type : "cardinal";

		return $$.isSplineType(d) ?
			interpolation : (
				$$.isStepType(d) ?
					$$.config.line_step_type : "linear"
			);
	}
});
