/* eslint-disable no-unused-vars, react/sort-comp */
// @flow
import * as i18n from "@khanacademy/wonder-blocks-i18n";
import PropTypes from "prop-types";
import * as React from "react";
import _ from "underscore";

import * as Changeable from "../mixins/changeable.jsx";
import WidgetJsonifyDeprecated from "../mixins/widget-jsonify-deprecated.jsx";

import type {WidgetExports} from "../types.js";

const MAX_SIZE = 8;

// Styling
const CELL_PADDING = 5;

const TABLE_STYLE = {
    display: "table",
    tableLayout: "fixed",
};

const ROW_STYLE = {
    display: "table-row",
};

const CELL_STYLE = {
    display: "table-cell",
    padding: CELL_PADDING,
};

const BASE_TILE_STYLE = {
    borderRadius: 10,
    cursor: "pointer",
};

const MOVE_COUNT_STYLE = {
    padding: CELL_PADDING,
    display: "inline-block",
};

const RESET_BUTTON_STYLE = {
    float: "right",
    paddingRight: CELL_PADDING,
};

const MAIN_TILE_SIZE = 50;

const mapCells = (cells, func) => {
    return _.map(cells, (row, y) => {
        return _.map(row, (value, x) => {
            return func(value, y, x);
        });
    });
};

const genCells = (height, width, func) => {
    return _.times(height, (y) => {
        return _.times(width, (x) => {
            return func(y, x);
        });
    });
};

const PATTERNS = {
    plus: () => [
        [false, true, false],
        [true, true, true],
        [false, true, false],
    ],
    x: () => [
        [true, false, true],
        [false, true, false],
        [true, false, true],
    ],
    "plus/x": (iter) => {
        return iter % 2 ? PATTERNS.x() : PATTERNS.plus();
    },
};

/**
 * Clamps value to an integer in the range [min, max]
 */
const clampToInt = function (value, min, max) {
    value = Math.floor(value);
    value = Math.max(value, min);
    value = Math.min(value, max);
    return value;
};

// A single glowy cell
class Tile extends React.Component<$FlowFixMe> {
    static propTypes = {
        value: PropTypes.bool.isRequired,
        size: PropTypes.number.isRequired,
    };

    render(): React.Node {
        const color = this.props.value ? "#55dd55" : "#115511";
        const style = _.extend({}, BASE_TILE_STYLE, {
            width: this.props.size,
            height: this.props.size,
            backgroundColor: color,
        });
        return <div style={style} onClick={this._flip} />;
    }

    _flip = () => {
        this.props.onChange(!this.props.value);
    };
}

// A grid of glowy cells
class TileGrid extends React.Component<$FlowFixMe> {
    static propTypes = {
        cells: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.bool)).isRequired,
        size: PropTypes.number.isRequired,
    };

    render(): React.Node {
        return (
            <div style={TABLE_STYLE} className="no-select">
                {_.map(this.props.cells, (row, y) => {
                    return (
                        <div key={y} style={ROW_STYLE}>
                            {_.map(row, (cell, x) => {
                                return (
                                    <div key={x} style={CELL_STYLE}>
                                        <Tile
                                            value={cell}
                                            size={this.props.size}
                                            onChange={_.partial(
                                                this.props.onChange,
                                                y,
                                                x,
                                            )}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        );
    }
}

// Returns a copy of the tiles, with tiles flipped according to
// whether or not their y, x position satisfies the predicate
const flipTilesPredicate = (oldCells, predicate) => {
    return _.map(oldCells, (row, y) => {
        return _.map(row, (cell, x) => {
            return predicate(y, x) ? !cell : cell;
        });
    });
};

const flipTilesPattern = (oldCells, tileY, tileX, pattern) => {
    return flipTilesPredicate(oldCells, (y, x) => {
        const offsetY = y - tileY;
        const offsetX = x - tileX;
        if (Math.abs(offsetY) <= 1 && Math.abs(offsetX) <= 1) {
            return pattern[offsetY + 1][offsetX + 1];
        }
        return false;
    });
};

// The lights puzzle widget
class LightsPuzzle extends React.Component<$FlowFixMe> {
    _currPattern: $FlowFixMe;
    _nextPattern: $FlowFixMe;
    _patternIndex: number;

    static propTypes = {
        ...Changeable.propTypes,
        cells: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.bool)),
        startCells: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.bool)),
        flipPattern: PropTypes.string.isRequired,
        moveCount: PropTypes.number.isRequired,
    };

    static defaultProps: $FlowFixMe = {
        cells: [
            [false, false, false],
            [false, false, false],
            [false, false, false],
        ],
        startCells: [
            [false, false, false],
            [false, false, false],
            [false, false, false],
        ],
        flipPattern: "plus",
        moveCount: 0,
    };

    getUserInput: () => $FlowFixMe = () => {
        return WidgetJsonifyDeprecated.getUserInput.call(this);
    };

    render(): React.Node {
        const width = this._width();
        const tileSize = MAIN_TILE_SIZE;
        const pxWidth = width * (tileSize + 2 * CELL_PADDING);
        return (
            <div>
                <TileGrid
                    cells={this.props.cells}
                    size={tileSize}
                    onChange={this._flipTile}
                />
                <div style={{width: pxWidth}}>
                    <div style={MOVE_COUNT_STYLE}>
                        {i18n.ngettext(
                            "Moves: %(num)s",
                            "Moves: %(num)s",
                            this.props.moveCount,
                        )}
                    </div>
                    <div style={RESET_BUTTON_STYLE}>
                        <input
                            type="button"
                            value="Reset"
                            onClick={this._reset}
                            className="simple-button"
                        />
                    </div>
                </div>
                <div className="clearfix" />
            </div>
        );
    }

    change: (...args: $ReadOnlyArray<mixed>) => $FlowFixMe = (...args) => {
        // $FlowFixMe[incompatible-call]
        return Changeable.change.apply(this, args);
    };

    _width: () => number = () => {
        if (this.props.cells.length !== 0) {
            return this.props.cells[0].length;
        }
        return 0; // default to 0
    };

    componentDidMount() {
        this._initNextPatterns();
    }

    componentDidUpdate(prevProps: $FlowFixMe) {
        if (prevProps.flipPattern !== this.props.flipPattern) {
            this._initNextPatterns();
        }
    }

    _initNextPatterns: () => void = () => {
        this._currPattern = PATTERNS[this.props.flipPattern](0);
        this._nextPattern = PATTERNS[this.props.flipPattern](1);
        this._patternIndex = 2;
    };

    _shiftPatterns: () => void = () => {
        this._currPattern = this._nextPattern;
        this._nextPattern = PATTERNS[this.props.flipPattern](
            this._patternIndex,
        );
        this._patternIndex++;
    };

    _flipTile: ($FlowFixMe, $FlowFixMe) => void = (tileY, tileX) => {
        const newCells = flipTilesPattern(
            this.props.cells,
            tileY,
            tileX,
            this._currPattern,
        );
        this._shiftPatterns();

        this.change({
            cells: newCells,
            moveCount: this.props.moveCount + 1,
        });
    };

    _reset: () => void = () => {
        this.change({
            cells: this.props.startCells,
            moveCount: 0,
        });
    };

    simpleValidate: ($FlowFixMe) => $FlowFixMe = (rubric) => {
        return validate(rubric, this.getUserInput());
    };
}

// grading function
const validate = function (rubric, state) {
    const empty = _.all(state.cells, (row, y) => {
        return _.all(row, (cell, x) => {
            return cell === rubric.startCells[y][x];
        });
    });
    if (empty) {
        return {
            type: "invalid",
            message: i18n._("Click on the tiles to change the lights."),
        };
    }

    const correct = _.all(state.cells, (row) => {
        return _.all(row, (cell) => {
            return cell;
        });
    });

    if (correct) {
        return {
            type: "points",
            earned: 1,
            total: 1,
            message: null,
        };
    }
    if (rubric.gradeIncompleteAsWrong) {
        return {
            type: "points",
            earned: 0,
            total: 1,
            message: null,
        };
    }
    return {
        type: "invalid",
        message: i18n._("You must turn on all of the lights to continue."),
    };
};

// The function run on the editor props to create the widget props
const transformProps: ($FlowFixMe) => $FlowFixMe = function (editorProps) {
    return {
        cells: editorProps.startCells,
        startCells: editorProps.startCells,
        flipPattern: editorProps.flipPattern,
    };
};

export default ({
    name: "lights-puzzle",
    displayName: "Lights Puzzle",
    hidden: true,
    widget: LightsPuzzle,
    transform: transformProps,
}: WidgetExports<typeof LightsPuzzle>);
