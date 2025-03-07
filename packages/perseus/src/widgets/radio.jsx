// @flow
import * as i18n from "@khanacademy/wonder-blocks-i18n";
import _ from "underscore";

import Util from "../util.js";

import Radio from "./radio/widget.jsx";

import type {PerseusRadioWidgetOptions} from "../perseus-types.js";
import type {WidgetExports} from "../types.js";
import type {RenderProps, RadioChoiceWithMetadata} from "./radio/widget.jsx";

const {shuffle, random} = Util;

// Represents choices that we automatically re-order if encountered.
// Note: these are in the reversed (incorrect) order that we will swap, if
// found.
// Note 2: these are internationalized when compared later on.
const ReversedChoices: $ReadOnlyArray<[string, string]> = [
    [i18n._("False"), i18n._("True")],
    [i18n._("No"), i18n._("Yes")],
];

// Transforms the choices for display.
const _choiceTransform = (
    widgetOptions: PerseusRadioWidgetOptions,
    problemNum: ?number,
) => {
    const _maybeRandomize = function (array) {
        const randomSeed = problemNum === undefined ? random : problemNum;
        // NOTE: `problemNum` will only be set when the radio widget is
        // rendered at the root of an exercise question. It will be `undefined`
        // if it's rendered embedded in another widget, such as `graded-group`,
        // or if rendered within an article. This results in a predictable
        // shuffle order. To avoid this we use a random seed when `problemNum`
        // is `undefined`.
        return widgetOptions.randomize
            ? shuffle(array, randomSeed ?? 0)
            : array;
    };

    const _addNoneOfAbove = function (
        choices: $ReadOnlyArray<RadioChoiceWithMetadata>,
    ) {
        let noneOfTheAbove = null;

        const newChoices = choices.filter((choice, index) => {
            if (choice.isNoneOfTheAbove) {
                noneOfTheAbove = choice;
                return false;
            }
            return true;
        });

        // Place the "None of the above" options last
        if (noneOfTheAbove) {
            newChoices.push(noneOfTheAbove);
        }

        return newChoices;
    };

    const enforceOrdering = (
        choices: $ReadOnlyArray<RadioChoiceWithMetadata>,
    ) => {
        const content = choices.map((c) => c.content);
        if (ReversedChoices.some((reversed) => _.isEqual(content, reversed))) {
            return [choices[1], choices[0]];
        }
        return choices;
    };

    // Add meta-information to choices
    const choices: $ReadOnlyArray<RadioChoiceWithMetadata> =
        widgetOptions.choices.map((choice, i): RadioChoiceWithMetadata => {
            return {
                ...choice,
                originalIndex: i,
                correct: Boolean(choice.correct),
            };
        });

    // Apply all the transforms. Note that the order we call these is
    // important!
    // 3) finally add "None of the above" to the bottom
    return _addNoneOfAbove(
        // 2) then (potentially) enforce ordering (eg. False, True becomes
        //    True, False)
        enforceOrdering(
            // 1) we randomize the order first
            _maybeRandomize(choices),
        ),
    );
};

const transform = (
    widgetOptions: PerseusRadioWidgetOptions,
    problemNum: ?number,
): RenderProps => {
    const choices = _choiceTransform(widgetOptions, problemNum);

    const numCorrect: number = _.reduce(
        widgetOptions.choices,
        function (memo, choice) {
            return choice.correct ? memo + 1 : memo;
        },
        0,
    );

    const {hasNoneOfTheAbove, multipleSelect, countChoices, deselectEnabled} =
        widgetOptions;

    return {
        numCorrect,
        hasNoneOfTheAbove,
        multipleSelect,
        countChoices,
        deselectEnabled,
        choices,
        selectedChoices: _.pluck(choices, "correct"),
    };
};

const propUpgrades = {
    "1": (v0props: $FlowFixMe): $FlowFixMe => {
        let choices;
        let hasNoneOfTheAbove;

        if (!v0props.noneOfTheAbove) {
            choices = v0props.choices;
            hasNoneOfTheAbove = false;
        } else {
            throw new Error(
                "radio widget v0 no longer supports auto noneOfTheAbove",
            );
        }

        return _.extend(_.omit(v0props, "noneOfTheAbove"), {
            choices: choices,
            hasNoneOfTheAbove: hasNoneOfTheAbove,
        });
    },
};

export default ({
    name: "radio",
    displayName: "Multiple choice",
    accessible: true,
    widget: Radio,
    transform: transform,
    staticTransform: transform,
    version: {major: 1, minor: 0},
    propUpgrades: propUpgrades,
    isLintable: true,
}: WidgetExports<typeof Radio>);
