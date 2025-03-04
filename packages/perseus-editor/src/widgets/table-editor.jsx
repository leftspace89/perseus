/* eslint-disable react/sort-comp */
// @flow
import {components, TableWidget, Util} from "@khanacademy/perseus";
import PropTypes from "prop-types";
import * as React from "react";
import ReactDOM from "react-dom";
import _ from "underscore";

import Editor from "../editor.jsx";

const {InfoTip, NumberInput} = components;
const Table = TableWidget.widget;

type Props = $FlowFixMe;

class TableEditor extends React.Component<Props> {
    static propTypes = {
        rows: PropTypes.number,
        columns: PropTypes.number,
        headers: PropTypes.arrayOf(PropTypes.string),
        answers: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)),
    };

    static widgetName: "table" = "table";

    static defaultProps: Props = (function () {
        const defaultRows = 4;
        const defaultColumns = 1;
        const blankAnswers = _(defaultRows).times(function () {
            return Util.stringArrayOfSize(defaultColumns);
        });
        return {
            headers: [""],
            rows: defaultRows,
            columns: defaultColumns,
            answers: blankAnswers,
        };
    })();

    focus: () => void = () => {
        // $FlowFixMe[incompatible-use]
        // $FlowFixMe[prop-missing]
        ReactDOM.findDOMNode(this.refs.numberOfColumns).focus(); // eslint-disable-line react/no-string-refs
    };

    render(): React.Node {
        const tableProps = _.pick(
            this.props,
            "headers",
            "answers",
            "onChange",
            "apiOptions",
        );
        _.extend(tableProps, {
            editableHeaders: true,
            Editor,
            onFocus: () => {},
            onBlur: () => {},
            trackInteraction: () => {},
        });

        return (
            <div>
                <div className="perseus-widget-row">
                    <label>
                        Number of columns:{" "}
                        <NumberInput
                            // eslint-disable-next-line react/no-string-refs
                            ref="numberOfColumns"
                            value={this.props.columns}
                            onChange={(val) => {
                                if (val) {
                                    this.onSizeInput(this.props.rows, val);
                                }
                            }}
                            useArrowKeys={true}
                        />
                    </label>
                </div>
                <div className="perseus-widget-row">
                    <label>
                        Number of rows:{" "}
                        <NumberInput
                            // eslint-disable-next-line react/no-string-refs
                            ref="numberOfRows"
                            value={this.props.rows}
                            onChange={(val) => {
                                if (val) {
                                    this.onSizeInput(val, this.props.columns);
                                }
                            }}
                            useArrowKeys={true}
                        />
                    </label>
                </div>
                <div>
                    {" "}
                    Table of answers:{" "}
                    <InfoTip>
                        <p>
                            The student has to fill out all cells in the table.
                            For partially filled tables create a table using the
                            template, and insert text input boxes as desired.
                        </p>
                    </InfoTip>
                </div>
                <div>
                    <Table {...tableProps} />
                </div>
            </div>
        );
    }

    onSizeInput: (number, number) => void = (numRawRows, numRawColumns) => {
        let rows = +numRawRows || 0;
        let columns = +numRawColumns || 0;
        rows = Math.min(Math.max(1, rows), 30);
        columns = Math.min(Math.max(1, columns), 6);
        const oldColumns = this.props.columns;
        const oldRows = this.props.rows;

        const answers = this.props.answers;
        // Truncate if necessary; else, append
        if (rows <= oldRows) {
            answers.length = rows;
        } else {
            _(rows - oldRows).times(function () {
                answers.push(Util.stringArrayOfSize(oldColumns));
            });
        }

        function fixColumnSizing(array) {
            // Truncate if necessary; else, append
            if (columns <= oldColumns) {
                array.length = columns;
            } else {
                _(columns - oldColumns).times(function () {
                    array.push("");
                });
            }
        }

        const headers = this.props.headers;
        fixColumnSizing(headers);
        _.each(answers, fixColumnSizing);

        this.props.onChange({
            rows: rows,
            columns: columns,
            answers: answers,
            headers: headers,
        });
    };

    serialize: () => $FlowFixMe = () => {
        const json = _.pick(this.props, "headers", "rows", "columns");

        return _.extend({}, json, {
            answers: _.map(this.props.answers, _.clone),
        });
    };
}

export default TableEditor;
