/* eslint-disable import/no-default-export */
// @flow
// This file describes the graphie source code of the kmath logo
// currently used on khan.github.io.
//
// Also located at http://ka-perseus-graphie.s3.amazonaws.com/42ef3cbadc3e6464124533191728c3c5c55c7355.svg

// eslint-disable-next-line ft-flow/no-types-missing-file-annotation
declare var init: $FlowFixMe;
// eslint-disable-next-line ft-flow/no-types-missing-file-annotation
declare var ellipse: $FlowFixMe;
// eslint-disable-next-line ft-flow/no-types-missing-file-annotation
declare var line: $FlowFixMe;

const GREEN = "#28AE7B";

export default () => {
    init({
        range: [
            [0, 10],
            [0, 10],
        ],
        scale: 40,
    });

    ellipse(5, 5, 5, {
        stroke: null,
        fill: GREEN,
    });

    line([2, 5], [8.5, 5], {
        stroke: "WHITE",
        fill: "WHITE",
        strokeWidth: 25,
        arrows: "->",
    });

    line([5, 2], [5, 8], {
        stroke: "WHITE",
        fill: "WHITE",
        strokeWidth: 25,
    });
};
