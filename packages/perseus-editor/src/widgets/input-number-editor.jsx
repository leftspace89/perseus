/* eslint-disable react/sort-comp */
// @flow
import {components, Util, InputNumber} from "@khanacademy/perseus";
import * as React from "react";
import ReactDOM from "react-dom";
import _ from "underscore";

import BlurInput from "../components/blur-input.jsx";

import type {ParsedValue} from "@khanacademy/perseus";

const {InfoTip} = components;

const answerTypes = {
    number: {
        name: "Numbers",
        forms: "integer, decimal, proper, improper, mixed",
    },
    decimal: {
        name: "Decimals",
        forms: "decimal",
    },
    integer: {
        name: "Integers",
        forms: "integer",
    },
    rational: {
        name: "Fractions and mixed numbers",
        forms: "integer, proper, improper, mixed",
    },
    improper: {
        name: "Improper numbers (no mixed)",
        forms: "integer, proper, improper",
    },
    mixed: {
        name: "Mixed numbers (no improper)",
        forms: "integer, proper, mixed",
    },
    percent: {
        name: "Numbers or percents",
        forms: "integer, decimal, proper, improper, mixed, percent",
    },
    pi: {
        name: "Numbers with pi",
        forms: "pi",
    },
};

type Props = {|
    value: number,
    simplify: React.ElementConfig<typeof InputNumber.widget>["simplify"],
    size: React.ElementConfig<typeof InputNumber.widget>["size"],
    inexact: React.ElementConfig<
        typeof InputNumber.widget,
    >["reviewModeRubric"]["inexact"],
    maxError: React.ElementConfig<
        typeof InputNumber.widget,
    >["reviewModeRubric"]["maxError"],
    answerType: React.ElementConfig<typeof InputNumber.widget>["answerType"],
    rightAlign: React.ElementConfig<typeof InputNumber.widget>["rightAlign"],

    onChange: ({|
        value?: ParsedValue | 0,
        simplify?: Props["simplify"],
        size?: Props["size"],
        inexact?: Props["inexact"],
        maxError?: Props["maxError"],
        answerType?: Props["answerType"],
        rightAlign?: Props["rightAlign"],
    |}) => void,
|};

type DefaultProps = {|
    value: Props["value"],
    simplify: Props["simplify"],
    size: Props["size"],
    inexact: Props["inexact"],
    maxError: Props["maxError"],
    answerType: Props["answerType"],
    rightAlign: Props["rightAlign"],
|};

class InputNumberEditor extends React.Component<Props> {
    static widgetName: "input-number" = "input-number";

    static defaultProps: DefaultProps = {
        value: 0,
        simplify: "required",
        size: "normal",
        inexact: false,
        maxError: 0.1,
        answerType: "number",
        rightAlign: false,
    };

    handleAnswerChange: (string) => void = (str) => {
        const value = Util.firstNumericalParse(str) || 0;
        this.props.onChange({value: value});
    };

    render(): React.Node {
        const answerTypeOptions = _.map(
            answerTypes,
            function (v, k) {
                return (
                    <option value={k} key={k}>
                        {v.name}
                    </option>
                );
            },
            this,
        );

        return (
            <div>
                <div>
                    <label>
                        Correct answer:{" "}
                        <BlurInput
                            value={"" + this.props.value}
                            onChange={this.handleAnswerChange}
                            // eslint-disable-next-line react/no-string-refs
                            ref="input"
                        />
                    </label>
                </div>

                <div>
                    <label>
                        Unsimplified answers{" "}
                        <select
                            value={this.props.simplify}
                            onChange={(e) => {
                                this.props.onChange({
                                    simplify: e.target.value,
                                });
                            }}
                        >
                            <option value="required">will not be graded</option>
                            <option value="optional">will be accepted</option>
                            <option value="enforced">
                                will be marked wrong
                            </option>
                        </select>
                    </label>
                    <InfoTip>
                        <p>
                            Normally select "will not be graded". This will give
                            the user a message saying the answer is correct but
                            not simplified. The user will then have to simplify
                            it and re-enter, but will not be penalized. (5th
                            grade and anything after)
                        </p>
                        <p>
                            Select "will be accepted" only if the user is not
                            expected to know how to simplify fractions yet.
                            (Anything prior to 5th grade)
                        </p>
                        <p>
                            Select "will be marked wrong" only if we are
                            specifically assessing the ability to simplify.
                        </p>
                    </InfoTip>
                </div>

                <div>
                    <label>
                        <input
                            type="checkbox"
                            checked={this.props.inexact}
                            onChange={(e) => {
                                this.props.onChange({
                                    inexact: e.target.checked,
                                });
                            }}
                        />{" "}
                        Allow inexact answers
                    </label>

                    <label>
                        <input /* TODO(emily): don't use a hidden checkbox
                        for alignment */
                            type="checkbox"
                            style={{visibility: "hidden"}}
                        />
                        Max error:{" "}
                        <input
                            type="text"
                            disabled={!this.props.inexact}
                            defaultValue={this.props.maxError}
                            onBlur={(e) => {
                                const ans =
                                    "" +
                                    // $FlowFixMe[incompatible-type]
                                    (Util.firstNumericalParse(e.target.value) ||
                                        0);
                                e.target.value = ans;
                                this.props.onChange({maxError: ans});
                            }}
                        />
                    </label>
                </div>

                <div>
                    Answer type:{" "}
                    <select
                        value={this.props.answerType}
                        onChange={(e) => {
                            this.props.onChange({answerType: e.target.value});
                        }}
                    >
                        {answerTypeOptions}
                    </select>
                    <InfoTip>
                        <p>
                            Use the default "Numbers" unless the answer must be
                            in a specific form (e.g., question is about
                            converting decimals to fractions).
                        </p>
                    </InfoTip>
                </div>

                <div>
                    <label>
                        Width{" "}
                        <select
                            value={this.props.size}
                            onChange={(e) => {
                                this.props.onChange({size: e.target.value});
                            }}
                        >
                            <option value="normal">Normal (80px)</option>
                            <option value="small">Small (40px)</option>
                        </select>
                    </label>
                    <InfoTip>
                        <p>
                            Use size "Normal" for all text boxes, unless there
                            are multiple text boxes in one line and the answer
                            area is too narrow to fit them.
                        </p>
                    </InfoTip>
                </div>

                <div>
                    <label>
                        <input
                            type="checkbox"
                            checked={this.props.rightAlign}
                            onChange={(e) => {
                                this.props.onChange({
                                    rightAlign: e.target.checked,
                                });
                            }}
                        />{" "}
                        Right alignment
                    </label>
                </div>
            </div>
        );
    }

    focus: () => boolean = () => {
        // $FlowFixMe[incompatible-use]
        // $FlowFixMe[prop-missing]
        ReactDOM.findDOMNode(this.refs.input).focus(); // eslint-disable-line react/no-string-refs
        return true;
    };

    serialize: () => {|
        value: Props["value"],
        simplify: Props["simplify"],
        size: Props["size"],
        inexact: Props["inexact"],
        maxError: Props["maxError"],
        answerType: Props["answerType"],
        rightAlign: Props["rightAlign"],
    |} = () => ({
        value: this.props.value,
        simplify: this.props.simplify,
        size: this.props.size,
        inexact: this.props.inexact,
        maxError: this.props.maxError,
        answerType: this.props.answerType,
        rightAlign: this.props.rightAlign,
    });
}

export default InputNumberEditor;
