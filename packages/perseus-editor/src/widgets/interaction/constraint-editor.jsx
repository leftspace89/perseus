// @flow
import {components, Changeable, Dependencies} from "@khanacademy/perseus";
import * as React from "react";

const {ButtonGroup, MathInput, NumberInput} = components;

type Props = {|
    ...Changeable.ChangeableProps,
    constraint: string,
    constraintFn: string,
    constraintXMax: string,
    constraintXMin: string,
    constraintYMax: string,
    constraintYMin: string,
    snap: number,
|};

type DefaultProps = {|
    constraint: Props["constraint"],
    constraintFn: Props["constraintFn"],
    constraintXMax: Props["constraintXMax"],
    constraintXMin: Props["constraintXMin"],
    constraintYMax: Props["constraintYMax"],
    constraintYMin: Props["constraintYMin"],
    snap: Props["snap"],
|};

class ConstraintEditor extends React.Component<Props> {
    static defaultProps: DefaultProps = {
        constraint: "none",
        snap: 0.5,
        constraintFn: "0",
        constraintXMin: "-10",
        constraintXMax: "10",
        constraintYMin: "-10",
        constraintYMax: "10",
    };

    change: (
        propName: string,
    ) => (value: any, callback?: () => mixed) => mixed = (
        propName: string,
    ): ((value: any, callback?: () => mixed) => mixed) => {
        // $FlowFixMe[incompatible-return](WEB-1727): change is an overloaded function, but we aren't typing it as overloaded
        return Changeable.change.call(this, propName);
    };

    render(): React.Element<"div"> {
        const {TeX} = Dependencies.getDependencies();

        return (
            <div>
                <div className="perseus-widget-row">
                    Constraint:{" "}
                    <ButtonGroup
                        value={this.props.constraint}
                        allowEmpty={false}
                        buttons={[
                            {value: "none", content: "None"},
                            {value: "snap", content: "Snap"},
                            {value: "x", content: "x="},
                            {value: "y", content: "y="},
                        ]}
                        onChange={this.change("constraint")}
                    />
                </div>
                {this.props.constraint === "snap" && (
                    <div className="perseus-widget-row">
                        Snap:{" "}
                        <NumberInput
                            value={this.props.snap}
                            placeholder={0}
                            onChange={this.change("snap")}
                        />
                    </div>
                )}
                {this.props.constraint === "x" && (
                    <div className="graph-settings">
                        <div className="perseus-widget-row">
                            <TeX>x=</TeX>{" "}
                            <MathInput
                                buttonSets={[]}
                                buttonsVisible="never"
                                value={this.props.constraintFn}
                                onChange={this.change("constraintFn")}
                            />
                        </div>
                    </div>
                )}
                {this.props.constraint === "y" && (
                    <div className="graph-settings">
                        <div className="perseus-widget-row">
                            <TeX>y=</TeX>{" "}
                            <MathInput
                                buttonSets={[]}
                                buttonsVisible="never"
                                value={this.props.constraintFn}
                                onChange={this.change("constraintFn")}
                            />
                        </div>
                    </div>
                )}
                Ensure these are set so nothing can be dragged off the canvas:
                <div className="perseus-widget-row">
                    <div className="perseus-widget-row">
                        <TeX>x \in \Large[</TeX>{" "}
                        <MathInput
                            buttonSets={[]}
                            buttonsVisible="never"
                            value={this.props.constraintXMin}
                            onChange={this.change("constraintXMin")}
                        />
                        <TeX>, </TeX>{" "}
                        <MathInput
                            buttonSets={[]}
                            buttonsVisible="never"
                            value={this.props.constraintXMax}
                            onChange={this.change("constraintXMax")}
                        />{" "}
                        <TeX>\Large]</TeX>
                    </div>
                </div>
                <div className="perseus-widget-row">
                    <div className="perseus-widget-row">
                        <TeX>y \in \Large[</TeX>{" "}
                        <MathInput
                            buttonSets={[]}
                            buttonsVisible="never"
                            value={this.props.constraintYMin}
                            onChange={this.change("constraintYMin")}
                        />
                        <TeX>, </TeX>{" "}
                        <MathInput
                            buttonSets={[]}
                            buttonsVisible="never"
                            value={this.props.constraintYMax}
                            onChange={this.change("constraintYMax")}
                        />{" "}
                        <TeX>\Large]</TeX>
                    </div>
                </div>
            </div>
        );
    }
}

export default ConstraintEditor;
