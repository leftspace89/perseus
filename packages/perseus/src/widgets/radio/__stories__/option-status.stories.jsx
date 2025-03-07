// @flow
import * as React from "react";

import OptionStatus from "../option-status.jsx";

type StoryArgs = {|
    crossedOut: boolean,
    checked: boolean,
    correct: boolean,
    previouslyAnswered: boolean,
    reviewMode: boolean,
    satStyling: boolean,
|};

type Story = {|
    title: string,
    args: StoryArgs,
|};

export default ({
    title: "Perseus/Widgets/Radio/Option Status",
    args: {
        crossedOut: false,
        checked: false,
        correct: false,
        previouslyAnswered: false,
        reviewMode: true,
        satStyling: false,
    },
}: Story);

export const Interactive = (args: StoryArgs): React.Node => {
    return <OptionStatus {...args} />;
};

export const AllPossibleOutputs = (args: StoryArgs): React.Node => {
    return (
        <>
            <div>
                Checked Correct:
                <OptionStatus
                    crossedOut={false}
                    checked={true}
                    correct={true}
                    previouslyAnswered={true}
                    reviewMode={true}
                    satStyling={false}
                />
            </div>
            <hr />
            <div>
                Checked Not Correct:
                <OptionStatus
                    crossedOut={false}
                    checked={true}
                    correct={false}
                    previouslyAnswered={true}
                    reviewMode={true}
                    satStyling={false}
                />
            </div>
            <hr />
            <div>
                Not Checked Correct:
                <OptionStatus
                    crossedOut={false}
                    checked={false}
                    correct={true}
                    previouslyAnswered={true}
                    reviewMode={true}
                    satStyling={false}
                />
            </div>
            <hr />
            <div>
                Not Checked Not Correct Previously Answered:
                <OptionStatus
                    crossedOut={false}
                    checked={false}
                    correct={false}
                    previouslyAnswered={true}
                    reviewMode={true}
                    satStyling={false}
                />
            </div>
            <hr />
            <div>
                Not Checked Not Correct Not Previously Answered:
                <OptionStatus
                    crossedOut={false}
                    checked={false}
                    correct={false}
                    previouslyAnswered={false}
                    reviewMode={true}
                    satStyling={false}
                />
            </div>
            <hr />
            <div>
                Crossed Out Correct:
                <OptionStatus
                    crossedOut={true}
                    checked={false}
                    correct={true}
                    previouslyAnswered={false}
                    reviewMode={true}
                    satStyling={false}
                />
            </div>
        </>
    );
};
