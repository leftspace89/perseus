/* eslint-disable react/sort-comp */
// @flow
import {linterContextDefault} from "@khanacademy/perseus-linter";
import * as i18n from "@khanacademy/wonder-blocks-i18n";
import {StyleSheet, css} from "aphrodite";
import classNames from "classnames";
import * as React from "react";
import _ from "underscore";

import InlineIcon from "../components/inline-icon.jsx";
import {iconCircle, iconCircleThin} from "../icon-paths.js";
import * as Changeable from "../mixins/changeable.jsx";
import WidgetJsonifyDeprecated from "../mixins/widget-jsonify-deprecated.jsx";
import {ClassNames as ApiClassNames} from "../perseus-api.jsx";
import Renderer from "../renderer.jsx";
import mediaQueries from "../styles/media-queries.js";
import sharedStyles from "../styles/shared.js";
import Util from "../util.js";

import type {PerseusCategorizerWidgetOptions} from "../perseus-types.js";
import type {PerseusScore, WidgetExports, WidgetProps} from "../types.js";

type UserInput = $FlowFixMe;

export type Rubric = PerseusCategorizerWidgetOptions;

type Props = {|
    ...WidgetProps<RenderProps, Rubric>,
    values: $ReadOnlyArray<string>,
|};

type DefaultProps = {|
    items: Props["items"],
    categories: Props["categories"],
    values: Props["values"],
    linterContext: Props["linterContext"],
|};

type State = {|
    uniqueId: string,
|};

export class Categorizer extends React.Component<Props, State> {
    static defaultProps: DefaultProps = {
        items: [],
        categories: [],
        values: [],
        linterContext: linterContextDefault,
    };

    state: State = {
        uniqueId: _.uniqueId("perseus_radio_"),
    };

    change: (...args: $ReadOnlyArray<mixed>) => $FlowFixMe = (...args) => {
        // $FlowFixMe[incompatible-call]
        return Changeable.change.apply(this, args);
    };

    getUserInput: () => UserInput = () => {
        return Categorizer.getUserInputFromProps(this.props);
    };

    render(): React.Node {
        const self = this;

        // In this context, isMobile is used to differentiate mobile from
        // desktop.
        const isMobile = this.props.apiOptions.isMobile;
        let indexedItems = this.props.items.map((item, n) => [item, n]);
        if (this.props.randomizeItems) {
            // $FlowFixMe[incompatible-call]
            indexedItems = Util.shuffle(indexedItems, this.props.problemNum);
        }

        const table = (
            <table className={"categorizer-table " + css(styles.mobileTable)}>
                <thead>
                    <tr>
                        <td className={css(styles.emptyHeaderCell)} />
                        {this.props.categories.map((category, i) => {
                            // Array index is the correct key here, as that's
                            // how category grading actually works -- no way
                            // to add or remove categories or items in the
                            // middle. (If we later add that, this should be
                            // fixed.)
                            return (
                                <th className={css(styles.header)} key={i}>
                                    <Renderer
                                        content={category}
                                        linterContext={this.props.linterContext}
                                    />
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {indexedItems.map((indexedItem) => {
                        const item = indexedItem[0];
                        const itemNum = indexedItem[1];
                        const uniqueId = self.state.uniqueId + "_" + itemNum;
                        return (
                            <tr key={itemNum}>
                                <td>
                                    <Renderer
                                        content={item}
                                        linterContext={this.props.linterContext}
                                    />
                                </td>
                                {self.props.categories.map(
                                    (catName, catNum) => {
                                        const selected =
                                            self.props.values[itemNum] ===
                                            catNum;
                                        return (
                                            <td
                                                className={
                                                    "category " +
                                                    css(styles.cell)
                                                }
                                                key={catNum}
                                            >
                                                {/* a pseudo-label: toggle the
                                value of the checkbox when this div or the
                                checkbox is clicked */}
                                                <div
                                                    className={
                                                        ApiClassNames.INTERACTIVE
                                                    }
                                                    role="button"
                                                    aria-label={catName}
                                                    // eslint-disable-next-line react/jsx-no-bind
                                                    onClick={this.onChange.bind(
                                                        this,
                                                        itemNum,
                                                        catNum,
                                                    )}
                                                >
                                                    {isMobile && (
                                                        <input
                                                            type="radio"
                                                            name={uniqueId}
                                                            className={css(
                                                                sharedStyles.responsiveInput,
                                                                sharedStyles.responsiveRadioInput,
                                                            )}
                                                            checked={selected}
                                                            // eslint-disable-next-line react/jsx-no-bind
                                                            onChange={this.onChange.bind(
                                                                this,
                                                                itemNum,
                                                                catNum,
                                                            )}
                                                            onClick={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                        />
                                                    )}
                                                    {!isMobile && (
                                                        <span
                                                            className={css(
                                                                styles.radioSpan,
                                                                selected &&
                                                                    styles.checkedRadioSpan,
                                                                this.props
                                                                    .static &&
                                                                    selected &&
                                                                    styles.staticCheckedRadioSpan,
                                                            )}
                                                        >
                                                            {selected ? (
                                                                <InlineIcon
                                                                    {...iconCircle}
                                                                />
                                                            ) : (
                                                                <InlineIcon
                                                                    {...iconCircleThin}
                                                                />
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    },
                                )}
                            </tr>
                        );
                        /* eslint-enable max-len */
                    })}
                </tbody>
            </table>
        );

        // TODO(benkomalo): kill CSS-based styling and move everything to
        // aphrodite.
        const extraClassNames = classNames({
            "categorizer-container": true,
            "static-mode": this.props.static,
        });
        const inlineStyles = this.props.apiOptions.isMobile
            ? [styles.fullBleedContainer]
            : [];

        return (
            <div className={extraClassNames + " " + css(...inlineStyles)}>
                {table}
            </div>
        );
    }

    onChange: (number, number) => void = (itemNum, catNum) => {
        const values = [...this.props.values];
        values[itemNum] = catNum;
        this.change("values", values);
        this.props.trackInteraction();
    };

    simpleValidate: (Rubric) => PerseusScore = (rubric) => {
        return Categorizer.validate(this.getUserInput(), rubric);
    };

    static validate(userInput: UserInput, rubric: Rubric): PerseusScore {
        let completed = true;
        let allCorrect = true;
        _.each(rubric.values, function (value, i) {
            if (userInput.values[i] == null) {
                completed = false;
            }
            if (userInput.values[i] !== value) {
                allCorrect = false;
            }
        });
        if (!completed) {
            return {
                type: "invalid",
                message: i18n._(
                    "Make sure you select something for every row.",
                ),
            };
        }
        return {
            type: "points",
            earned: allCorrect ? 1 : 0,
            total: 1,
            message: null,
        };
    }

    static getUserInputFromProps(props: Props): UserInput {
        return WidgetJsonifyDeprecated.getUserInputFromProps(props);
    }
}

// TODO(benkomalo): inject page-margin into Perseus instead of hardcoding.
const pageMargin = 16;

// Stylesheets aren't directly testable
/* c8 ignore next */
const styles = StyleSheet.create({
    mobileTable: {
        [mediaQueries.smOrSmaller]: {
            minWidth: "auto",
        },
    },

    fullBleedContainer: {
        [mediaQueries.mdOrSmaller]: {
            marginLeft: -pageMargin,
            marginRight: -pageMargin,
            overflowX: "auto",
        },
    },

    header: {
        textAlign: "center",
        verticalAlign: "bottom",
    },

    cell: {
        textAlign: "center",
        padding: 0,
        color: "#ccc",
        verticalAlign: "middle",
    },

    emptyHeaderCell: {
        backgroundColor: "inherit",
        borderBottom: "2px solid #ccc",
    },

    radioSpan: {
        fontSize: 30,
        paddingRight: 3,

        ":hover": {
            color: "#999",
        },
    },

    checkedRadioSpan: {
        color: "#333",
    },

    // .static-mode is applied by the Categorizer when the rendered
    // widget is static; in this case we gray out the choices to show
    // the user that the widget can't be interacted with.
    staticCheckedRadioSpan: {
        color: "#888",
    },
});

type RenderProps = {|
    items: PerseusCategorizerWidgetOptions["items"],
    categories: PerseusCategorizerWidgetOptions["categories"],
    randomizeItems: PerseusCategorizerWidgetOptions["randomizeItems"],
    // Depends on whether the widget is in static mode
    values?: PerseusCategorizerWidgetOptions["values"],
|};

export default ({
    name: "categorizer",
    displayName: "Categorizer",
    widget: Categorizer,
    transform: (
        widgetOptions: PerseusCategorizerWidgetOptions,
    ): RenderProps => {
        return _.pick(widgetOptions, "items", "categories", "randomizeItems");
    },
    staticTransform: (
        editorProps: PerseusCategorizerWidgetOptions,
    ): RenderProps => {
        return _.pick(
            editorProps,
            "items",
            "categories",
            "values",
            "randomizeItems",
        );
    },
    isLintable: true,
}: WidgetExports<typeof Categorizer>);
