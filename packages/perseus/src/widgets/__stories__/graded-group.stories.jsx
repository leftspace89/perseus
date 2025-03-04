// @flow
import * as React from "react";

import {RendererWithDebugUI} from "../../../../../testing/renderer-with-debug-ui.jsx";
import {question1} from "../__testdata__/graded-group_testdata.js";

type StoryArgs = {|
    isMobile: boolean,
|};

type Story = {|
    title: string,
    args: StoryArgs,
|};

export const Question1 = (args: StoryArgs): React.Node => {
    return (
        <RendererWithDebugUI
            question={question1}
            apiOptions={{
                isMobile: args.isMobile,
            }}
        />
    );
};

export default ({
    title: "Perseus/Widgets/Graded Group",
    args: {
        isMobile: false,
    },
}: Story);
