/* eslint-disable react/no-unsafe */
// @flow
import * as PerseusLinter from "@khanacademy/perseus-linter";
import classNames from "classnames";
import $ from "jquery";
import * as React from "react";
import ReactDOM from "react-dom";
import _ from "underscore";

import AssetContext from "./asset-context.js";
import SvgImage from "./components/svg-image.jsx";
import TeX from "./components/tex.jsx";
import ZoomableTeX from "./components/zoomable-tex.jsx";
import Zoomable from "./components/zoomable.jsx";
import {DefinitionProvider} from "./definition-context.js";
import {getDependencies} from "./dependencies.js";
import ErrorBoundary from "./error-boundary.jsx";
import InteractionTracker from "./interaction-tracker.js";
import Objective from "./interactive2/objective_.js";
import JiptParagraphs from "./jipt-paragraphs.js";
import {Errors, Log} from "./logging/log.js";
import {ClassNames as ApiClassNames, ApiOptions} from "./perseus-api.jsx";
import {PerseusError} from "./perseus-error.js";
import PerseusMarkdown from "./perseus-markdown.jsx";
import QuestionParagraph from "./question-paragraph.jsx";
import TranslationLinter from "./translation-linter.js";
import Util from "./util.js";
import preprocessTex from "./util/katex-preprocess.js";
import WidgetContainer from "./widget-container.jsx";
import * as Widgets from "./widgets.js";

import type {PerseusRenderer, PerseusWidgetOptions} from "./perseus-types.js";
import type {
    APIOptions,
    APIOptionsWithDefaults,
    FilterCriterion,
    FocusPath,
    LinterContextProps,
    PerseusDependencies,
    PerseusScore,
    WidgetInfo,
    WidgetProps,
} from "./types.js";

import "./styles/perseus-renderer.less";

const {mapObject, mapObjectFromArray} = Objective;

const rContainsNonWhitespace = /\S/;
const rImageURL = /(web\+graphie|https):\/\/[^\s]*/;

const noopOnRender = () => {};

const SHOULD_CLEAR_WIDGETS_PROP_LIST = ["content", "problemNum", "widgets"];

// Check if one focus path / id path is a prefix of another
// The focus path null will never be a prefix of any non-null
// path, since it represents no focus.
// Otherwise, prefix is calculated by whether every array
// element in the prefix is present in the same position in the
// wholeArray path.
const isIdPathPrefix = function (
    prefixArray: FocusPath,
    wholeArray: FocusPath,
) {
    if (prefixArray === null || wholeArray === null) {
        return prefixArray === wholeArray;
    }

    return _.every(prefixArray, (elem: string, i: number) => {
        if (wholeArray != null) {
            return _.isEqual(elem, wholeArray[i]);
        }
    });
};

type WidgetState = {|
    isMobile?: boolean,
    inTable?: boolean,
    key?: number,
    paragraphIndex?: number,
    foundFullWidth?: boolean,
    baseElements?: any,
|};

type SetWidgetPropsFn = (
    id: string,
    newProps: $FlowFixMe,
    cb: () => boolean,
    // Widgets can call `onChange` with `silent` set to `true` to prevent
    // interaction events from being triggered in listeners.
    silent?: boolean,
) => void;

// The return type for getUserInput. Widgets have full control of what is
// returned so it's not easily typed (some widgets return a scalar (string),
// some return a custom-built object, some delegate to
// `WidgetJsonifyDeprecated` which returns an object containing widget props
// (filtered by deprecated keys)).
type WidgetUserInput = $FlowFixMe;

type SerializedState = {[id: string]: any, ...};

export type Widget = {|
    focus: () =>
        | {|
              id: string,
              path: FocusPath,
          |}
        | boolean,
    getDOMNodeForPath: (path: FocusPath) => Element | Text | null,
    deselectIncorrectSelectedChoices?: () => void,
    restoreSerializedState: (props: any, callback: () => void) => any,
    // TODO(jeremy): I think this return value is wrong. The widget
    // getSerializedState should just return _its_ serialized state, not a
    // key/value list of all widget states (i think!)
    // Returns widget state that can be passed back to `restoreSerializedState`
    // to put the widget back into exactly the same state. If the widget does
    // not implement this function, the renderer simply returns all of the
    // widget's props.
    getSerializedState?: () => SerializedState, // SUSPECT
    getGrammarTypeForPath: (path: FocusPath) => string,
    blurInputPath?: (path: FocusPath) => null,
    focusInputPath?: (path: FocusPath) => null,
    getInputPaths?: () => $ReadOnlyArray<FocusPath>,
    setInputValue?: (
        path: FocusPath,
        newValue: string,
        focus: () => mixed, // TODO(jeremy): I think this is actually a callback
    ) => void,
    getUserInput?: () => ?WidgetUserInput,
    simpleValidate?: (
        options: any,
        onOutputError: ?(
            widgetId?: any,
            value: string,
            message: ?string,
        ) => mixed,
    ) => PerseusScore,
    showRationalesForCurrentlySelectedChoices?: (options?: any) => void,
    examples?: () => $ReadOnlyArray<string>,
|};

type Props = {|
    apiOptions?: APIOptions,
    alwaysUpdate?: boolean,
    // eslint-disable-next-line ft-flow/no-weak-types
    findExternalWidgets: Function,
    highlightedWidgets?: $ReadOnlyArray<any>,
    images: PerseusRenderer["images"],
    keypadElement?: $FlowFixMe, // TODO(kevinb): add proper flow types
    onInteractWithWidget: (id: string) => void,
    onRender: (node: any) => void,
    problemNum?: number,
    questionCompleted?: boolean,
    reviewMode?: ?boolean,
    content: PerseusRenderer["content"],

    serializedState?: any,
    // Callback which is called when serialized state changes with the new
    // serialized state.
    onSerializedStateUpdated: (serializedState: {[string]: any, ...}) => mixed,

    // If linterContext.highlightLint is true, then content will be passed
    // to the linter and any warnings will be highlighted in the rendered
    // output.
    linterContext: LinterContextProps,

    legacyPerseusLint?: $ReadOnlyArray<string>,
    widgets: PerseusRenderer["widgets"],
|};

type State = {|
    translationLintErrors: $ReadOnlyArray<string>,
    widgetInfo: $ReadOnly<{|[id: string]: ?WidgetInfo|}>,
    widgetProps: $ReadOnly<{|[id: string]: ?$FlowFixMe|}>,
    jiptContent: any,
    lastUsedWidgetId: ?string,
|};

type Context = {
    ...LinterContextProps,
    content: string,
    widgets: {[id: string]: any, ...},
    // This is inexact because LinterContextProps is inexact
    ...
};

type DefaultProps = {|
    alwaysUpdate: Props["alwaysUpdate"],
    content: Props["content"],
    findExternalWidgets: Props["findExternalWidgets"],
    highlightedWidgets: Props["highlightedWidgets"],
    images: Props["images"],
    linterContext: Props["linterContext"],
    onInteractWithWidget: Props["onInteractWithWidget"],
    onRender: Props["onRender"],
    onSerializedStateUpdated: Props["onSerializedStateUpdated"],
    questionCompleted: Props["questionCompleted"],
    reviewMode: Props["reviewMode"],
    serializedState: Props["serializedState"],
    widgets: Props["widgets"],
|};

class Renderer extends React.Component<Props, State> {
    _currentFocus: ?FocusPath;
    _foundTextNodes: boolean;
    _interactionTrackers: {[id: string]: InteractionTracker, ...};
    _isMounted: boolean;
    _isTwoColumn: boolean;

    // The i18n linter.
    _translationLinter: TranslationLinter;

    lastRenderedMarkdown: React.Element<PerseusDependencies["KatexProvider"]>;
    reuseMarkdown: boolean;
    translationIndex: number;
    // eslint-disable-next-line ft-flow/no-mutable-array
    widgetIds: Array<string>;

    static defaultProps: DefaultProps = {
        content: "",
        widgets: {},
        images: {},
        highlightedWidgets: [],
        questionCompleted: false,
        // onRender may be called multiple times per render, for example
        // if there are multiple images or TeX pieces within `content`.
        // It is a good idea to debounce any functions passed here.
        onRender: noopOnRender,
        onInteractWithWidget: function () {},
        findExternalWidgets: () => [],
        alwaysUpdate: false,
        reviewMode: false,
        serializedState: null,
        onSerializedStateUpdated: () => {},
        linterContext: PerseusLinter.linterContextDefault,
    };

    constructor(props: Props, context: Context) {
        super(props, context);
        this._translationLinter = new TranslationLinter();

        this.state = {
            jiptContent: null,

            // TranslationLinter is async and currently does not contain a
            // location. This is a list of error strings TranslationLinter
            // detected on its last run.
            translationLintErrors: [],

            // The ID of the last widget the user interacted with. We'll
            // use this to set the `isLastUsedWidget` flag on the
            // corresponding widget.
            lastUsedWidgetId: null,

            ...this._getInitialWidgetState(props),
        };
    }

    componentDidMount() {
        this._isMounted = true;

        // figure out why we're passing an empty object
        // $FlowFixMe[incompatible-exact]: Flow considers empty objects to be inexact and handleRender is expecting an exact object.
        this.handleRender({});
        this._currentFocus = null;

        // TODO(emily): actually make the serializedState prop work like a
        // controlled prop, instead of manually calling .restoreSerializedState
        // at the right times.
        if (this.props.serializedState) {
            this.restoreSerializedState(this.props.serializedState);
        }

        if (this.props.linterContext.highlightLint) {
            // Get i18n lint errors asynchronously. If there are lint errors,
            // this component will be rerendered.
            this._translationLinter.runLinter(
                this.props.content,
                this.handletranslationLintErrors,
            );
        }
    }

    UNSAFE_componentWillReceiveProps(nextProps: Props) {
        if (
            !_.isEqual(
                _.pick(this.props, SHOULD_CLEAR_WIDGETS_PROP_LIST),
                _.pick(nextProps, SHOULD_CLEAR_WIDGETS_PROP_LIST),
            )
        ) {
            this.setState(this._getInitialWidgetState(nextProps));
        }
    }

    shouldComponentUpdate(nextProps: Props, nextState: State): any | boolean {
        // QUESTION(jeremy): Shouldn't we look at `nextProps` here? Otherwise
        // we're always looking "one render behind".
        if (this.props.alwaysUpdate) {
            // TOTAL hacks so that findWidgets doesn't break
            // when one widget updates without the other.
            // See passage-refs inside radios, which was why
            // this was introduced.
            // I'm sorry!
            // TODO(aria): cry
            //
            // HACK(djf): I've also set this alwaysUpdate property from
            // async-renderer.jsx in the manticore-package. I'm doing this
            // to work around an infinite loop of some sort that started
            // happening in manticore after the React 16 update. After
            // clicking around in the manticore exercise editor (for example)
            // the UI would freeze up, and the debugger would show that
            // we were always deep in a recursion on the propsChanged line
            // below. There is some kind of timing issue causing some kind
            // of infinite loop, but by avoiding the time-consuming deep
            // equal comparisons on our props (which are often huge) I can
            // no longer reproduce the bug.
            // TODO(djf): Remove this comment
            // https://khanacademy.atlassian.net/browse/CP-834 is resolved.
            return true;
        }
        const stateChanged = !_.isEqual(this.state, nextState);
        const propsChanged = !_.isEqual(this.props, nextProps);
        return propsChanged || stateChanged;
    }

    UNSAFE_componentWillUpdate(nextProps: Props, nextState: State) {
        const oldJipt = this.shouldRenderJiptPlaceholder(
            this.props,
            this.state,
        );
        const newJipt = this.shouldRenderJiptPlaceholder(nextProps, nextState);
        const oldContent = this.getContent(this.props, this.state);
        const newContent = this.getContent(nextProps, nextState);
        const oldHighlightedWidgets = this.props.highlightedWidgets;
        const newHighlightedWidgets = nextProps.highlightedWidgets;

        // TODO(jared): This seems to be a perfect overlap with
        // "shouldComponentUpdate" -- can we just remove this
        // componentWillUpdate and the reuseMarkdown attr?
        this.reuseMarkdown =
            !oldJipt &&
            !newJipt &&
            oldContent === newContent &&
            _.isEqual(
                this.state.translationLintErrors,
                nextState.translationLintErrors,
            ) &&
            // If we are running the linter then we need to know when
            // widgets have changed because we need for force the linter to
            // run when that happens. Note: don't do identity comparison here:
            // it can cause frequent re-renders that break MathJax somehow
            (!this.props.linterContext.highlightLint ||
                _.isEqual(this.props.widgets, nextProps.widgets)) &&
            // If the linter is turned on or off, we have to rerender
            this.props.linterContext.highlightLint ===
                nextProps.linterContext.highlightLint &&
            // yes, this is identity array comparison, but these are passed
            // in from state in the item-renderer, so they should be
            // identity equal unless something changed, and it's expensive
            // to loop through them to look for differences.
            // Technically, we could reuse the markdown when this changes,
            // but to do that we'd have to do more expensive checking of
            // whether a widget should be highlighted in the common case
            // where this array hasn't changed, so we just redo the whole
            // render if this changed
            oldHighlightedWidgets === newHighlightedWidgets;
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        this.handleRender(prevProps);
        // We even do this if we did reuse the markdown because
        // we might need to update the widget props on this render,
        // even though we have the same widgets.
        // WidgetContainers don't update their widgets' props when
        // they are re-rendered, so even if they've been
        // re-rendered we need to call these methods on them.
        _.each(this.widgetIds, (id) => {
            // eslint-disable-next-line react/no-string-refs
            const container = this.refs["container:" + id];
            container && container.replaceWidgetProps(this.getWidgetProps(id));
        });

        if (
            this.props.serializedState &&
            !_.isEqual(this.props.serializedState, this.getSerializedState())
        ) {
            this.restoreSerializedState(this.props.serializedState);
        }

        if (this.props.linterContext.highlightLint) {
            // Get i18n lint errors asynchronously. If lint errors have changed
            // since the last run, this component will be rerendered.
            this._translationLinter.runLinter(
                this.props.content,
                this.handletranslationLintErrors,
            );
        }
    }

    componentWillUnmount() {
        // Clean out the list of widgetIds when unmounting, as this list is
        // meant to be consistent with the refs controlled by the renderer, and
        // refs are also cleared out during unmounting.
        // (This may not be totally necessary, but mobile clients have been
        // seeing JS errors due to an inconsistency between the list of
        // widgetIds and the child refs of the renderer.
        // See: https://phabricator.khanacademy.org/D32420.)
        this.widgetIds = [];

        if (this.translationIndex != null) {
            // NOTE(jeremy): Since the translationIndex is simply the array
            // index of each renderer, we can't remove Renderers from this
            // list, rather, we simply null out the entry (which means that
            // this array's growth is unbounded until a page reload).
            getDependencies().rendererTranslationComponents.removeComponentAtIndex(
                this.translationIndex,
            );
        }

        this._isMounted = false;
    }

    getApiOptions: () => APIOptionsWithDefaults = () => {
        return {
            ...ApiOptions.defaults,
            ...this.props.apiOptions,
        };
    };

    _getInitialWidgetState: (props: Props) => {|
        widgetInfo: State["widgetInfo"],
        widgetProps: State["widgetProps"],
    |} = (props: Props) => {
        const allWidgetInfo = this._getAllWidgetsInfo(props);
        return {
            widgetInfo: allWidgetInfo,
            widgetProps: this._getAllWidgetsStartProps(allWidgetInfo, props),
        };
    };

    _getAllWidgetsInfo: (props: Props) => {|[string]: WidgetInfo|} = (
        props: Props,
    ) => {
        return mapObject(props.widgets, (widgetInfo, widgetId) => {
            if (!widgetInfo.type || !widgetInfo.alignment) {
                const newValues = {};

                if (!widgetInfo.type) {
                    newValues.type = widgetId.split(" ")[0];
                }
                if (!widgetInfo.alignment) {
                    newValues.alignment = "default";
                }

                widgetInfo = _.extend({}, widgetInfo, newValues);
            }
            return Widgets.upgradeWidgetInfoToLatestVersion(widgetInfo);
        });
    };

    _getAllWidgetsStartProps: (
        allWidgetInfo: {|[string]: WidgetInfo|},
        props: Props,
    ) => any = (allWidgetInfo, props) => {
        return mapObject(allWidgetInfo, (widgetInfo) => {
            return Widgets.getRendererPropsForWidgetInfo(
                widgetInfo,
                props.problemNum,
            );
        });
    };

    // This is only used in _getWidgetInfo as a fallback if widgetId
    // doesn't exist in this.state.widgetInfo.  It doesn't get run as
    // part of the happy path.
    // TODO(LP-10713): Refactor how we handle widgetIds that don't exist
    // in this.state.widgetInfo.
    _getDefaultWidgetInfo: (widgetId: string) => $FlowFixMe = (
        widgetId: string,
    ) => {
        const widgetIdParts = Util.rTypeFromWidgetId.exec(widgetId);
        if (widgetIdParts == null) {
            // We should probably return null here since there's no
            // widget with the given id.
            // NOTE(jeremy): Further, the widgetId we were given does not even
            // look like a widget ID (ie. `widget-type \d+`). I can't figure
            // out how to trigger this line of code though.
            /* c8 ignore next line */
            return {};
        }
        return {
            type: widgetIdParts[1],
            graded: true,
            options: {},
        };
    };

    _getWidgetInfo: (widgetId: string) => WidgetInfo = (
        widgetId: string,
    ): WidgetInfo => {
        return (
            this.state.widgetInfo[widgetId] ||
            this._getDefaultWidgetInfo(widgetId)
        );
    };

    renderWidget: (
        impliedType: string,
        id: string,
        state: WidgetState,
    ) => null | React.Node = (
        impliedType: string,
        id: string,
        state: WidgetState,
    ) => {
        const widgetInfo = this.state.widgetInfo[id];

        if (widgetInfo && widgetInfo.alignment === "full-width") {
            state.foundFullWidth = true;
        }

        if (widgetInfo) {
            const type = (widgetInfo && widgetInfo.type) || impliedType;
            const shouldHighlight = _.contains(
                this.props.highlightedWidgets,
                id,
            );

            // By this point we should have no duplicates, which are
            // filtered out in this.render(), so we shouldn't have to
            // worry about using this widget key and ref:
            return (
                <ErrorBoundary key={"container:" + id}>
                    <WidgetContainer
                        ref={"container:" + id}
                        type={type}
                        initialProps={this.getWidgetProps(id)}
                        shouldHighlight={shouldHighlight}
                        linterContext={PerseusLinter.pushContextStack(
                            this.props.linterContext,
                            "widget",
                        )}
                    />
                </ErrorBoundary>
            );
        }
        return null;
    };

    getWidgetProps: (
        id: string,
    ) => WidgetProps<$FlowFixMe, PerseusWidgetOptions> = (id) => {
        const apiOptions = this.getApiOptions();
        const widgetProps = this.state.widgetProps[id] || {};

        // The widget needs access to its "rubric" at all times when in review
        // mode (which is really just part of its widget info).
        let reviewModeRubric = null;
        const widgetInfo = this.state.widgetInfo[id];
        if (this.props.reviewMode && widgetInfo) {
            reviewModeRubric = widgetInfo.options;
        }

        if (!this._interactionTrackers) {
            this._interactionTrackers = {};
        }

        let interactionTracker = this._interactionTrackers[id];
        if (!interactionTracker) {
            interactionTracker = this._interactionTrackers[id] =
                new InteractionTracker(
                    apiOptions.trackInteraction,
                    // $FlowFixMe[incompatible-call]
                    widgetInfo && widgetInfo.type,
                    id,
                    // $FlowFixMe[incompatible-call]
                    Widgets.getTracking(widgetInfo && widgetInfo.type),
                );
        }

        return {
            ...widgetProps,
            ref: id,
            widgetId: id,
            alignment: widgetInfo && widgetInfo.alignment,
            // When determining if a widget is static, we verify that the widget is not an
            // exercise question by verifying that it has no problem number.
            static: widgetInfo && widgetInfo.static && !this.props.problemNum,
            problemNum: this.props.problemNum,
            apiOptions: this.getApiOptions(),
            keypadElement: this.props.keypadElement,
            questionCompleted: this.props.questionCompleted,
            onFocus: _.partial(this._onWidgetFocus, id),
            onBlur: _.partial(this._onWidgetBlur, id),
            findWidgets: this.findWidgets,
            reviewModeRubric: reviewModeRubric,
            onChange: (newProps, cb, silent = false) => {
                this._setWidgetProps(id, newProps, cb, silent);
            },
            trackInteraction: interactionTracker.track,
            isLastUsedWidget: id === this.state.lastUsedWidgetId,
        };
    };

    /**
     * Serializes the questions state so it can be recovered.
     *
     * The return value of this function can be sent to the
     * `restoreSerializedState` method to restore this state.
     *
     * If an instance of widgetProps is passed in, it generates the serialized
     * state from that instead of the current widget props.
     */
    getSerializedState: (widgetProps: any) => {[id: string]: any, ...} = (
        widgetProps: any,
    ): {[id: string]: any, ...} => {
        return mapObject(
            widgetProps || this.state.widgetProps,
            (props, widgetId) => {
                const widget = this.getWidgetInstance(widgetId);
                if (widget && widget.getSerializedState) {
                    return widget.getSerializedState();
                }
                return props;
            },
        );
    };

    restoreSerializedState: (
        serializedState: SerializedState,
        callback?: () => void,
    ) => void = (serializedState: SerializedState, callback?: () => void) => {
        // Do some basic validation on the serialized state (just make sure the
        // widget IDs are what we expect).
        const serializedWidgetIds = _.keys(serializedState);
        const widgetPropIds = _.keys(this.state.widgetProps);

        // If the two lists of IDs match (ignoring order)
        if (
            serializedWidgetIds.length !== widgetPropIds.length ||
            _.intersection(serializedWidgetIds, widgetPropIds).length !==
                serializedWidgetIds.length
        ) {
            Log.error(
                "Refusing to restore bad serialized state:",
                Errors.Internal,
                {
                    loggedMetadata: {
                        serializedState: JSON.stringify(serializedState),
                        currentProps: JSON.stringify(this.state.widgetProps),
                    },
                },
            );
            return;
        }

        // We want to wait until any children widgets who have a
        // restoreSerializedState function also call their own callbacks before
        // we declare that the operation is finished.
        let numCallbacks = 1;
        const fireCallback = () => {
            --numCallbacks;
            if (callback && numCallbacks === 0) {
                callback();
            }
        };

        this.setState(
            {
                widgetProps: mapObject(serializedState, (props, widgetId) => {
                    const widget = this.getWidgetInstance(widgetId);
                    if (widget && widget.restoreSerializedState) {
                        // Note that we probably can't call
                        // `this.change()/this.props.onChange()` in this
                        // function, so we take the return value and use
                        // that as props if necessary so that
                        // `restoreSerializedState` in a widget can
                        // change the props as well as state.
                        // If a widget has no props to change, it can
                        // safely return null.
                        ++numCallbacks;
                        const restoreResult = widget.restoreSerializedState(
                            props,
                            fireCallback,
                        );
                        return _.extend(
                            {},
                            this.state.widgetProps[widgetId],
                            restoreResult,
                        );
                    }
                    return props;
                }),
            },
            () => {
                // Wait until all components have rendered. In React 16 setState
                // callback fires immediately after this componentDidUpdate, and
                // there is no guarantee that parent/siblings components have
                // finished rendering.
                // TODO(jeff, CP-3128): Use Wonder Blocks Timing API
                // eslint-disable-next-line no-restricted-syntax
                setTimeout(fireCallback, 0);
            },
        );
    };

    /**
     * Tell each of the radio widgets to show rationales for each of the
     * currently selected choices inside of them. If the widget is correct, it
     * shows rationales for all of the choices. This also disables interaction
     * with the choices that we show rationales for.
     */
    showRationalesForCurrentlySelectedChoices: () => void = () => {
        Object.keys(this.props.widgets).forEach((widgetId) => {
            const widget = this.getWidgetInstance(widgetId);
            if (widget && widget.showRationalesForCurrentlySelectedChoices) {
                // $FlowFixMe[not-a-function]: figure out why this check isn't working
                widget.showRationalesForCurrentlySelectedChoices(
                    this._getWidgetInfo(widgetId).options,
                );
            }
        });
    };

    /**
     * Tells each of the radio widgets to deselect any of the incorrect choices
     * that are currently selected (leaving correct choices still selected).
     */
    deselectIncorrectSelectedChoices: () => void = () => {
        // TODO(emily): this has the exact same structure as
        // showRationalesForCurrentlySelectedChoices above. Maybe DRY this up.
        Object.keys(this.props.widgets).forEach((widgetId) => {
            const widget = this.getWidgetInstance(widgetId);
            if (widget && widget.deselectIncorrectSelectedChoices) {
                widget.deselectIncorrectSelectedChoices();
            }
        });
    };

    /**
     * Allows inter-widget communication.
     *
     * This function yields this Renderer's own internal widgets, and it's used
     * in two places.
     *
     * First, we expose our own internal widgets to each other by giving them
     * a `findWidgets` function that, in turn, calls this function.
     *
     * Second, we expose our own internal widgets to this Renderer's parent,
     * by allowing it to call this function directly. That way, it can hook us
     * up to other Renderers on the page, by writing a `findExternalWidgets`
     * prop that calls each other Renderer's `findInternalWidgets` function.
     *
     * Takes a `filterCriterion` on which widgets to return.
     * `filterCriterion` can be one of:
     *  * A string widget id
     *  * A string widget type
     *  * a function from (id, widgetInfo, widgetComponent) to true or false
     *
     * Returns an array of the matching widget components.
     *
     * If you need to do logic with more than the components, it is possible
     * to do such logic inside the filter, rather than on the result array.
     *
     * See the passage-ref widget for an example.
     *
     * "Remember: abilities are not inherently good or evil, it's how you use
     * them." ~ Kyle Katarn
     * Please use this one with caution.
     */
    findInternalWidgets: (
        filterCriterion: FilterCriterion,
    ) => $ReadOnlyArray<?Widget> = (filterCriterion: FilterCriterion) => {
        let filterFunc;
        // Convenience filters:
        // "interactive-graph 3" will give you [[interactive-graph 3]]
        // "interactive-graph" will give you all interactive-graphs
        if (typeof filterCriterion === "string") {
            if (filterCriterion.indexOf(" ") !== -1) {
                const widgetId = filterCriterion;
                filterFunc = (
                    id: string,
                    widgetInfo: WidgetInfo,
                    widget: ?Widget,
                ) => id === widgetId;
            } else {
                const widgetType = filterCriterion;
                filterFunc = (
                    id: string,
                    widgetInfo: WidgetInfo,
                    widget: ?Widget,
                ) => {
                    return widgetInfo.type === widgetType;
                };
            }
        } else {
            filterFunc = filterCriterion;
        }

        const results: $ReadOnlyArray<?Widget> = this.widgetIds
            .filter((id: string) => {
                const widgetInfo = this._getWidgetInfo(id);
                const widget = this.getWidgetInstance(id);
                return filterFunc(id, widgetInfo, widget);
            })
            .map(this.getWidgetInstance);

        return results;
    };

    /**
     * Allows inter-widget communication.
     *
     * Includes both widgets internal to this Renderer, and external widgets
     * exposed by the `findExternalWidgets` prop.
     *
     * See `findInteralWidgets` for more information.
     */
    findWidgets: (filterCriterion: FilterCriterion) => any = (
        filterCriterion: FilterCriterion,
    ) => {
        return [
            ...this.findInternalWidgets(filterCriterion),
            ...this.props.findExternalWidgets(filterCriterion),
        ];
    };

    getWidgetInstance: (id: string) => ?Widget = (id: string): ?Widget => {
        // eslint-disable-next-line react/no-string-refs
        const ref = this.refs["container:" + id];
        if (!ref) {
            return null;
        }
        return ref.getWidget();
    };

    _onWidgetFocus: (id: string, focusPath?: $ReadOnlyArray<string>) => void = (
        id: string,
        focusPath: $ReadOnlyArray<string> = [],
    ) => {
        if (!_.isArray(focusPath)) {
            throw new PerseusError(
                "widget props.onFocus focusPath must be an Array, " +
                    "but was" +
                    JSON.stringify(focusPath),
                Errors.Internal,
            );
        }
        this._setCurrentFocus([id].concat(focusPath));
    };

    _onWidgetBlur: (id: string, blurPath: FocusPath) => void = (
        id: string,
        blurPath: FocusPath,
    ) => {
        const blurringFocusPath = this._currentFocus;

        // Failsafe: abort if ID is different, because focus probably happened
        // before blur
        const fullPath = [id].concat(blurPath);
        if (!_.isEqual(fullPath, blurringFocusPath)) {
            return;
        }

        // Wait until after any new focus events fire this tick before
        // declaring that nothing is focused.
        // If a different widget was focused, we'll see an onBlur event
        // now, but then an onFocus event on a different element before
        // this callback is executed
        _.defer(() => {
            if (_.isEqual(this._currentFocus, blurringFocusPath)) {
                this._setCurrentFocus(null);
            }
        });
    };

    getContent: (props: Props, state: State) => any = (
        props: Props,
        state: State,
    ) => {
        return state.jiptContent || props.content;
    };

    shouldRenderJiptPlaceholder: (props: Props, state: State) => boolean = (
        props: Props,
        state: State,
    ): boolean => {
        // TODO(aria): Pass this in via webapp as an apiOption
        return (
            getDependencies().JIPT.useJIPT &&
            state.jiptContent == null &&
            props.content.indexOf("crwdns") !== -1
        );
    };

    replaceJiptContent: (content: string, paragraphIndex: number) => void = (
        content: string,
        paragraphIndex: number,
    ) => {
        if (paragraphIndex == null) {
            // we're not translating paragraph-wise; replace the whole content
            // (we could also theoretically check for apiOptions.isArticle
            // here, which is what causes paragraphIndex to not be null)
            this.setState({
                jiptContent: content,
            });
        } else {
            // This is the same regex we use in perseus/translate.py to find
            // code blocks. We use it to count entire code blocks as
            // paragraphs.
            const codeFenceRegex =
                /^\s*(`{3,}|~{3,})\s*(\S+)?\s*\n([\s\S]+?)\s*\1\s*$/;

            if (codeFenceRegex.test(content)) {
                // If a paragraph is a code block, we're going to treat it as a
                // single paragraph even if it has double-newlines in it, so
                // skip the next two checks.
            } else if (/\S\n\s*\n\S/.test(content)) {
                // Our "render the exact same QuestionParagraphs each time"
                // strategy will fail if we allow translating a paragraph
                // to more than one paragraph. This hack renders as a single
                // paragraph and lets the translator know to not use \n\n,
                // hopefully. We can't wait for linting because we can't
                // safely render the node.
                // TODO(aria): Check for the max number of backticks or tildes
                // in the content, and just render a red code block of the
                // content here instead?
                content =
                    "$\\large{\\red{\\text{Please translate each " +
                    "paragraph to a single paragraph.}}}$";
            } else if (/^\s*$/.test(content)) {
                // We similarly can't have an all-whitespace paragraph, or
                // we will parse it as the closing of the previous paragraph
                content =
                    "$\\large{\\red{\\text{Translated paragraph is " +
                    "currently empty}}}$";
            }
            // Split the paragraphs; we have to use getContent() in case
            // nothing has been translated yet (in which case we just have
            // this.props.content)
            const allContent = this.getContent(this.props, this.state);
            const paragraphs = JiptParagraphs.parseToArray(allContent);
            paragraphs[paragraphIndex] = content;
            this.setState({
                jiptContent: JiptParagraphs.joinFromArray(paragraphs),
            });
        }
    };

    // wrap top-level elements in a QuestionParagraph, mostly
    // for appropriate spacing and other css
    outputMarkdown: (ast: any, state: WidgetState) => React.Node = (
        ast: any,
        state: WidgetState,
    ) => {
        if (_.isArray(ast)) {
            // This is duplicated from simple-markdown
            // TODO(aria): Don't duplicate this logic
            const oldKey = state.key;
            const result = [];

            // map nestedOutput over the ast, except group any text
            // nodes together into a single string output.
            // NOTE(aria): These are never strings--always QuestionParagraphs
            // TODO(aria): We probably don't need this string logic here.
            let lastWasString = false;
            for (let i = 0; i < ast.length; i++) {
                state.key = i;
                state.paragraphIndex = i;
                const nodeOut = this.outputMarkdown(ast[i], state);
                const isString = typeof nodeOut === "string";
                // NOTE(jeremy): As far as I can tell, this if is _never_
                // reached. As noted above, these are always QuestionParagraphs
                // now.
                /* c8 ignore if */
                if (typeof nodeOut === "string" && lastWasString) {
                    /**
                     * $FlowIgnore[incompatible-type]
                     * We know that last was string, but Flow can't see this
                     * refinement.
                     */
                    result[result.length - 1] += nodeOut;
                } else {
                    result.push(nodeOut);
                }
                lastWasString = isString;
            }

            state.key = oldKey;
            return result;
        }
        // !!! WARNING: Mutative hacks! mutates `this._foundTextNodes`:
        // because I wrote a bad interface to simple-markdown.js' `output`
        this._foundTextNodes = false;
        state.foundFullWidth = false;
        const output = this.outputNested(ast, state);

        // In Jipt-land, we need to render the exact same outer
        // QuestionParagraph nodes always. This means the number of
        // paragraphs needs to stay the same, and we can't modify
        // the classnames on the QuestionParagraphs or we'll destroy
        // the crowdin classnames. So we just only use the
        // 'paragraph' classname from the QuestionParagraph.
        // If this becomes a problem it would be easy to fix by wrapping
        // the nodes in an extra layer (hopefully only for jipt) that
        // handles the jipt classnames, and let this layer handle the
        // dynamic classnames.
        // We can't render the classes the first time and leave them
        // the same because we don't know at the time of the first
        // render whether they are full-bleed or centered, since they
        // only contain crowdin IDs like `crwdns:972384209:0...`
        let className;
        if (this.translationIndex != null) {
            className = null;
        } else {
            className = classNames({
                "perseus-paragraph-centered": !this._foundTextNodes,
                // There is only one node being rendered,
                // and it's a full-width widget.
                "perseus-paragraph-full-width":
                    state.foundFullWidth && ast.content.length === 1,
            });
        }

        return (
            <QuestionParagraph
                key={state.key}
                className={className}
                translationIndex={this.translationIndex}
                paragraphIndex={state.paragraphIndex}
            >
                <ErrorBoundary>{output}</ErrorBoundary>
            </QuestionParagraph>
        );
    };

    // output non-top-level nodes or arrays
    outputNested: (ast: any, state: WidgetState) => React.Node = (
        ast: any,
        state: WidgetState,
    ) => {
        if (_.isArray(ast)) {
            // This is duplicated from simple-markdown
            // TODO(aria): Don't duplicate this logic
            const oldKey = state.key;
            const result = [];

            // map nestedOutput over the ast, except group any text
            // nodes together into a single string output.
            let lastWasString = false;
            for (let i = 0; i < ast.length; i++) {
                state.key = i;
                const nodeOut = this.outputNested(ast[i], state);
                const isString = typeof nodeOut === "string";
                if (typeof nodeOut === "string" && lastWasString) {
                    /**
                     * We know that last was string, but Flow can't see this
                     * refinement.
                     */
                    // $FlowIgnore[incompatible-type]
                    result[result.length - 1] += nodeOut;
                } else {
                    result.push(nodeOut);
                }
                lastWasString = isString;
            }

            state.key = oldKey;
            return result;
        }
        return this.outputNode(ast, this.outputNested, state);
    };

    // output individual AST nodes [not arrays]
    outputNode: (
        node: any,
        nestedOutput: any,
        state: WidgetState,
    ) =>
        | any
        | null
        | React.Element<"div">
        | React.Element<"span">
        | React.Node = (node: any, nestedOutput: any, state: WidgetState) => {
        const apiOptions = this.getApiOptions();
        const imagePlaceholder = apiOptions.imagePlaceholder;

        if (node.type === "widget") {
            const widgetPlaceholder = apiOptions.widgetPlaceholder;

            if (widgetPlaceholder) {
                return widgetPlaceholder;
            }
            // Widgets can contain text nodes, so we don't center them with
            // markdown magic here.
            // Instead, we center them with css magic in articles.less
            // /cry(aria)
            this._foundTextNodes = true;

            if (_.contains(this.widgetIds, node.id)) {
                // We don't want to render a duplicate widget key/ref,
                // as this causes problems with react (for obvious
                // reasons). Instead we just notify the
                // hopefully-content-creator that they need to change the
                // widget id.
                return (
                    <span key={state.key} className="renderer-widget-error">
                        {[
                            "Widget [[",
                            "☃",
                            " ",
                            node.id,
                            "]] already exists.",
                        ].join("")}
                    </span>
                );
            }
            this.widgetIds.push(node.id);
            return this.renderWidget(node.widgetType, node.id, state);
        }
        if (node.type === "blockMath") {
            // We render math here instead of in perseus-markdown.jsx
            // because we need to pass it our onRender callback.
            const content = preprocessTex(node.content);

            const innerStyle = {
                // HACK(benkomalo): we only want horizontal scrolling, but
                // overflowX: 'auto' causes a vertical scrolling scrollbar
                // as well, despite the parent and child elements having
                // the exact same height. Force it to not scroll by
                // applying overflowY: 'hidden'
                overflowX: "auto",
                overflowY: "hidden",

                // HACK(kevinb): overflowY: 'hidden' inadvertently clips the
                // top and bottom of some fractions.  We add padding to the
                // top and bottom to avoid the clipping and then correct for
                // the padding by adding equal but opposite margins.
                paddingTop: 10,
                paddingBottom: 10,
                marginTop: -10,
                marginBottom: -10,
            };

            if (apiOptions.isMobile) {
                // The style for the body of articles and exercises on mobile is
                // to have a 16px margin.  When a user taps to zoom math we'd
                // like the math to extend all the way to the edge of the page/
                // To achieve this affect we nest the Zoomable component in two
                // nested divs. The outer div has a negative margin to
                // counteract the margin on main perseus container.  The inner
                // div adds the margin back as padding so that when the math is
                // scaled out it's inset from the edge of the page.  When the
                // TeX component is full size it will extend to the edge of the
                // page if it's larger than the page.
                //
                // TODO(kevinb) automatically determine the margin size
                const margin = 16;
                const outerStyle = {
                    marginLeft: -margin,
                    marginRight: -margin,
                };
                const horizontalPadding = {
                    paddingLeft: margin,
                    paddingRight: margin,
                };

                const mobileInnerStyle = {
                    ...innerStyle,
                    ...styles.mobileZoomableParentFix,
                };

                return (
                    <div
                        key={state.key}
                        className="perseus-block-math"
                        style={outerStyle}
                    >
                        <ErrorBoundary>
                            <div
                                className="perseus-block-math-inner"
                                style={{
                                    ...mobileInnerStyle,
                                    ...horizontalPadding,
                                }}
                            >
                                <ZoomableTeX>{content}</ZoomableTeX>
                            </div>
                        </ErrorBoundary>
                    </div>
                );
            }
            return (
                <div key={state.key} className="perseus-block-math">
                    <ErrorBoundary>
                        <div
                            className="perseus-block-math-inner"
                            style={innerStyle}
                        >
                            <AssetContext.Consumer>
                                {({setAssetStatus}) => (
                                    <TeX setAssetStatus={setAssetStatus}>
                                        {content}
                                    </TeX>
                                )}
                            </AssetContext.Consumer>
                        </div>
                    </ErrorBoundary>
                </div>
            );
        }
        if (node.type === "math") {
            // Replace uses of \begin{align}...\end{align} which KaTeX doesn't
            // support (yet) with \begin{aligned}...\end{aligned} which renders
            // the same is supported by KaTeX.  It does the same for align*.
            // TODO(kevinb) update content to use aligned instead of align.
            const tex = node.content.replace(/\{align[*]?\}/g, "{aligned}");

            // We render math here instead of in perseus-markdown.jsx
            // because we need to pass it our onRender callback.
            return (
                <span
                    key={state.key}
                    style={{
                        // If math is directly next to text, don't let it
                        // wrap to the next line
                        whiteSpace: "nowrap",
                    }}
                >
                    <ErrorBoundary>
                        {/* We add extra empty spans around the math to make it not
                        wrap (I don't know why this works, but it does) */}
                        <span />
                        <AssetContext.Consumer>
                            {({setAssetStatus}) => (
                                <TeX
                                    onRender={this.props.onRender}
                                    setAssetStatus={setAssetStatus}
                                >
                                    {tex}
                                </TeX>
                            )}
                        </AssetContext.Consumer>
                        <span />
                    </ErrorBoundary>
                </span>
            );
        }
        if (node.type === "image") {
            if (imagePlaceholder) {
                return imagePlaceholder;
            }

            // We need to add width and height to images from our
            // props.images mapping.

            // We do a _.has check here to avoid weird things like
            // 'toString' or '__proto__' as a url.
            const extraAttrs = _.has(this.props.images, node.target)
                ? this.props.images[node.target]
                : null;

            // The width of a table column is determined by the widest table
            // cell within that column, but responsive images constrain
            // themselves to the width of their parent containers. Thus,
            // responsive images don't do very well within tables. To avoid
            // haphazard sizing, simply make images within tables unresponsive.
            // TODO(alex): Make tables themselves responsive.
            const responsive = !state.inTable;
            return (
                <ErrorBoundary key={state.key}>
                    <AssetContext.Consumer>
                        {({setAssetStatus}) => (
                            <SvgImage
                                setAssetStatus={setAssetStatus}
                                /* $FlowFixMe[incompatible-type]: sanitizeUrl() can return null */
                                src={PerseusMarkdown.sanitizeUrl(node.target)}
                                alt={node.alt}
                                title={node.title}
                                responsive={responsive}
                                onUpdate={this.props.onRender}
                                zoomToFullSizeOnMobile={
                                    apiOptions.isMobile && apiOptions.isArticle
                                }
                                {...extraAttrs}
                            />
                        )}
                    </AssetContext.Consumer>
                </ErrorBoundary>
            );
        }
        if (node.type === "columns") {
            // Note that we have two columns. This is so we can put
            // a className on the outer renderer content for SAT.
            // TODO(aria): See if there is a better way we can do
            // things like this
            this._isTwoColumn = true;
            // but then render normally:
            return (
                <ErrorBoundary key={state.key}>
                    {PerseusMarkdown.ruleOutput(node, nestedOutput, state)}
                </ErrorBoundary>
            );
        }
        if (node.type === "text") {
            if (rContainsNonWhitespace.test(node.content)) {
                this._foundTextNodes = true;
            }

            // Used by the translator portal to replace image URLs with
            // placeholders, see preprocessWidgets in manticore-utils.js
            // for more details.
            if (imagePlaceholder && rImageURL.test(node.content)) {
                return imagePlaceholder;
            }
            return node.content;
        }
        if (node.type === "table" || node.type === "titledTable") {
            const output = PerseusMarkdown.ruleOutput(node, nestedOutput, {
                ...state,
                isMobile: apiOptions.isMobile,
                inTable: true,
            });

            if (!apiOptions.isMobile) {
                return output;
            }

            const margin = 16;
            const outerStyle = {
                marginLeft: -margin,
                marginRight: -margin,
            };
            const innerStyle = {
                paddingLeft: 0,
                paddingRight: 0,
            };
            const mobileInnerStyle = {
                ...innerStyle,
                ...styles.mobileZoomableParentFix,
            };

            const wrappedOutput = (
                <div style={{...mobileInnerStyle, overflowX: "auto"}}>
                    <ErrorBoundary>
                        <Zoomable animateHeight={true}>{output}</Zoomable>
                    </ErrorBoundary>
                </div>
            );

            // TODO(benkomalo): how should we deal with tappable items inside
            // of tables?
            return <div style={outerStyle}>{wrappedOutput}</div>;
        }
        // If it's a "normal" or "simple" markdown node, just
        // output it using its output rule.
        return (
            <ErrorBoundary key={state.key}>
                {PerseusMarkdown.ruleOutput(node, nestedOutput, state)}
            </ErrorBoundary>
        );
    };

    handleRender: (prevProps: Props) => void = (prevProps: Props) => {
        const onRender = this.props.onRender;
        const oldOnRender = prevProps.onRender;

        // In the common case of no callback specified, avoid this work.
        if (onRender !== noopOnRender || oldOnRender !== noopOnRender) {
            const $images = $(ReactDOM.findDOMNode(this)).find("img");

            // Fire callback on image load...
            if (oldOnRender !== noopOnRender) {
                $images.off("load", oldOnRender);
            }

            if (onRender !== noopOnRender) {
                $images.on("load", onRender);
            }
        }

        // ...as well as right now (non-image, non-TeX or image from cache)
        onRender();
    };

    // Sets the current focus path
    // If the new focus path is not a prefix of the old focus path,
    // we send an onChangeFocus event back to our parent.
    _setCurrentFocus: (path: FocusPath) => void = (path: FocusPath) => {
        const apiOptions = this.getApiOptions();

        // We don't do this when the new path is a prefix because
        // that prefix is already focused (we're just in a more specific
        // area of it). This makes it safe to call _setCurrentFocus
        // whenever a widget is interacted with--we won't wipe out
        // our focus state if we are already focused on a subpart
        // of that widget (i.e. a transformation NumberInput inside
        // of a transformer widget).
        if (!isIdPathPrefix(path, this._currentFocus)) {
            const prevFocus = this._currentFocus;

            if (prevFocus) {
                this.blurPath(prevFocus);
            }

            this._currentFocus = path;
            apiOptions.onFocusChange(this._currentFocus, prevFocus);
        }
    };

    focus: () => ?boolean = () => {
        let id;
        let focusResult;
        for (let i = 0; i < this.widgetIds.length; i++) {
            const widgetId = this.widgetIds[i];
            const widget = this.getWidgetInstance(widgetId);
            const widgetFocusResult = widget && widget.focus && widget.focus();
            if (widgetFocusResult) {
                id = widgetId;
                focusResult = widgetFocusResult;
                break;
            }
        }

        if (id) {
            // reconstruct a {path, element} focus object
            let path;
            if (typeof focusResult === "object") {
                // TODO(jeremy): I am 99% sure this path is no longer possible.
                // In D10274, focus management sometimes returned an object
                // with a `path` and `element` key. But later in D11387 and
                // D13664 things have been changed and seemingly removed the
                // object return value.
                // The result of focus was a {path, id} object itself
                path = [id].concat(focusResult.path || []);
                Log.error(
                    "Renderer received a focus result of type 'object' " +
                        "instead of the expected type 'boolean'",
                    Errors.Internal,
                    {
                        loggedMetadata: {
                            focusResult: JSON.stringify(focusResult),
                            currentProps: JSON.stringify(
                                this.state.widgetProps,
                            ),
                        },
                    },
                );
            } else {
                // The result of focus was true or the like; just
                // construct a root focus object
                path = [id];
            }

            this._setCurrentFocus(path);
            return true;
        }
    };

    getDOMNodeForPath: (path: FocusPath) => ?(Element | Text) = (
        path: FocusPath,
    ) => {
        const widgetId = _.first(path);
        const interWidgetPath = _.rest(path);

        // Widget handles parsing of the interWidgetPath. If the path is empty
        // beyond the widgetID, as a special case we just return the widget's
        // DOM node.
        const widget = this.getWidgetInstance(widgetId);
        const getNode = widget && widget.getDOMNodeForPath;
        if (getNode) {
            return getNode(interWidgetPath);
        }
        if (interWidgetPath.length === 0) {
            // $FlowFixMe[incompatible-call]: make Widget a ReactInstance type
            return ReactDOM.findDOMNode(widget);
        }
    };

    getGrammarTypeForPath: (path: FocusPath) => ?string = (path: FocusPath) => {
        const widgetId = _.first(path);
        const interWidgetPath = _.rest(path);

        const widget = this.getWidgetInstance(widgetId);
        if (widget && widget.getGrammarTypeForPath) {
            return widget.getGrammarTypeForPath(interWidgetPath);
        }
    };

    getInputPaths: () => $ReadOnlyArray<FocusPath> = () => {
        const inputPaths: Array<FocusPath> = [];
        _.each(this.widgetIds, (widgetId: string) => {
            const widget = this.getWidgetInstance(widgetId);
            if (widget && widget.getInputPaths) {
                // Grab all input paths and add widgetID to the front
                const widgetInputPaths = widget.getInputPaths();
                // Prefix paths with their widgetID and add to collective
                // list of paths.
                _.each(widgetInputPaths, (inputPath: string) => {
                    const relativeInputPath = [widgetId].concat(inputPath);
                    inputPaths.push(relativeInputPath);
                });
            }
        });

        return inputPaths;
    };

    focusPath: (path: FocusPath) => void = (path: FocusPath) => {
        // No need to focus if it's already focused
        if (_.isEqual(this._currentFocus, path)) {
            return;
        }
        if (this._currentFocus) {
            // Unfocus old path, if exists
            this.blurPath(this._currentFocus);
        }

        const widgetId = _.first(path);
        const interWidgetPath = _.rest(path);

        // Widget handles parsing of the interWidgetPath
        const focusWidget = this.getWidgetInstance(widgetId);
        if (focusWidget && focusWidget.focusInputPath) {
            focusWidget.focusInputPath(interWidgetPath);
        }
    };

    blurPath: (path: FocusPath) => void = (path: FocusPath) => {
        // No need to blur if it's not focused
        if (!_.isEqual(this._currentFocus, path)) {
            return;
        }

        const widgetId = _.first(path);
        const interWidgetPath = _.rest(path);
        const widget = this.getWidgetInstance(widgetId);
        // We might be in the editor and blurring a widget that no
        // longer exists, so only blur if we actually found the widget
        if (widget) {
            const blurWidget = this.getWidgetInstance(widgetId);
            if (blurWidget && blurWidget.blurInputPath) {
                // Widget handles parsing of the interWidgetPath
                blurWidget.blurInputPath(interWidgetPath);
            }
        }
    };

    blur: () => void = () => {
        if (this._currentFocus) {
            this.blurPath(this._currentFocus);
        }
    };

    // Serializes widget state. Seems to be used only by editors though.
    serialize: () => {...} = () => {
        const state = {};
        _.each(
            this.state.widgetInfo,
            function (info, id) {
                // eslint-disable-next-line @babel/no-invalid-this
                const widget = this.getWidgetInstance(id);
                const s = widget.serialize();
                if (!_.isEmpty(s)) {
                    state[id] = s;
                }
            },
            this,
        );
        return state;
    };

    emptyWidgets: () => any = () => {
        return _.filter(this.widgetIds, (id) => {
            const widgetInfo = this._getWidgetInfo(id);
            if (widgetInfo.static) {
                // Static widgets shouldn't count as empty
                return false;
            }
            const widget = this.getWidgetInstance(id);
            if (widget && widget.simpleValidate) {
                const score: PerseusScore = widget.simpleValidate(
                    widgetInfo.options,
                    null,
                );
                return Util.scoreIsEmpty(score);
            }
        });
    };

    _setWidgetProps: SetWidgetPropsFn = (id, newProps, cb, silent) => {
        this.setState(
            (prevState) => {
                const widgetProps = {
                    ...prevState.widgetProps,
                    [id]: {
                        ...prevState.widgetProps[id],
                        ...newProps,
                    },
                };

                // Update the `lastUsedWidgetId` to this widget - unless we're
                // in silent mode. We only want to track the last widget that
                // was actually _used_, and silent updates generally don't come
                // from _usage_.
                const lastUsedWidgetId = silent
                    ? prevState.lastUsedWidgetId
                    : id;

                if (!silent) {
                    this.props.onSerializedStateUpdated(
                        this.getSerializedState(widgetProps),
                    );
                }

                return {
                    lastUsedWidgetId,
                    widgetProps,
                };
            },
            () => {
                // Wait until all components have rendered. In React 16 setState
                // callback fires immediately after this componentDidUpdate, and
                // there is no guarantee that parent/siblings components have
                // finished rendering.
                // TODO(jeff, CP-3128): Use Wonder Blocks Timing API
                // eslint-disable-next-line no-restricted-syntax
                setTimeout(() => {
                    const cbResult = cb && cb();
                    if (!silent) {
                        this.props.onInteractWithWidget(id);
                    }
                    if (cbResult !== false) {
                        // TODO(jack): For some reason, some widgets don't always
                        // end up in refs here, which is repro-able if you make an
                        // [[ orderer 1 ]] and copy-paste this, then change it to
                        // be an [[ orderer 2 ]]. The resulting Renderer ends up
                        // with an "orderer 2" ref but not an "orderer 1" ref.
                        // @_@??
                        // TODO(jack): Figure out why this is happening and fix it
                        // As far as I can tell, this is only an issue in the
                        // editor-page, so doing this shouldn't break clients
                        // hopefully
                        this._setCurrentFocus([id]);
                    }
                }, 0);
            },
        );
    };

    setInputValue: (
        path: FocusPath,
        newValue: string,
        focus: () => mixed,
    ) => void = (path, newValue, focus) => {
        const widgetId = _.first(path);
        const interWidgetPath = _.rest(path);
        const widget = this.getWidgetInstance(widgetId);

        // Widget handles parsing of the interWidgetPath.
        widget?.setInputValue?.(interWidgetPath, newValue, focus);
    };

    /**
     * Returns an array of the widget `.getUserInput()` results
     */
    getUserInput: () => $ReadOnlyArray<?WidgetUserInput> = () => {
        return this.widgetIds.map((id: string) => {
            const widget = this.getWidgetInstance(id);
            if (widget && widget.getUserInput) {
                // TODO(Jeremy): Add the widget ID in here so we can more
                // easily correlate it to the widget state.
                return widget.getUserInput();
            }
        });
    };

    /**
     * Returns an array of all widget IDs in the order they occur in
     * the content.
     */
    getWidgetIds: () => $ReadOnlyArray<string> = () => {
        return this.widgetIds;
    };

    /**
     * Returns the result of `.getUserInput()` for each widget, in
     * a map from widgetId to userInput.
     * NOTE(jeremy): This function is hauntingly similar to `getUserInput` with
     * the major difference being that this function returns a map of
     * `widgetID` => UserInput and `getUserInput` simply returns an array. It
     * would be trivial to map between the results of each of these functions,
     * so we should aim to remove one of these functions.
     */
    getUserInputForWidgets: () => {[widgetId: string]: ?WidgetUserInput} =
        () => {
            return mapObjectFromArray(this.widgetIds, (id) => {
                const widget = this.getWidgetInstance(id);
                if (widget && widget.getUserInput) {
                    return widget.getUserInput();
                }
            });
        };

    /**
     * Returns an object mapping from widget ID to perseus-style score.
     * The keys of this object are the values of the array returned
     * from `getWidgetIds`.
     */
    scoreWidgets: () => {[widgetId: string]: PerseusScore} = () => {
        const widgetProps = this.state.widgetInfo;
        const onInputError = this.getApiOptions().onInputError;

        const gradedWidgetIds = _.filter(this.widgetIds, (id) => {
            const props = widgetProps[id];
            const widgetIsGraded: boolean =
                props?.graded == null || props.graded;
            const widgetIsStatic: boolean = !!props?.static;
            // Ungraded widgets or widgets set to static shouldn't be graded.
            return widgetIsGraded && !widgetIsStatic;
        });

        const widgetScores = {};
        _.each(gradedWidgetIds, (id) => {
            const props = widgetProps[id];
            const widget = this.getWidgetInstance(id);
            // widget can be undefined if it hasn't yet been rendered
            if (widget && widget.simpleValidate) {
                widgetScores[id] = widget.simpleValidate(
                    props?.options,
                    onInputError,
                );
            }
        });

        return widgetScores;
    };

    /**
     * Grades the content.
     */
    score: () => PerseusScore = () => {
        return _.reduce(this.scoreWidgets(), Util.combineScores, Util.noScore);
    };

    guessAndScore: () => [$FlowFixMe, PerseusScore] = () => {
        const totalGuess = this.getUserInput();
        const totalScore = this.score();

        return [totalGuess, totalScore];
    };

    examples: () => ?$ReadOnlyArray<string> = () => {
        const widgetIds = this.widgetIds;
        const examples = _.compact(
            _.map(widgetIds, (widgetId) => {
                const widget = this.getWidgetInstance(widgetId);
                return widget != null && widget.examples
                    ? widget.examples()
                    : null;
            }),
        );

        // no widgets with examples
        if (!examples.length) {
            return null;
        }

        const allEqual = _.all(examples, function (example) {
            return _.isEqual(examples[0], example);
        });

        // some widgets have different examples
        // TODO(alex): handle this better
        if (!allEqual) {
            return null;
        }

        return examples[0];
    };

    // TranslationLinter callback
    handletranslationLintErrors: (lintErrors: $ReadOnlyArray<string>) => void =
        (lintErrors: $ReadOnlyArray<string>) => {
            if (!this._isMounted) {
                return;
            }

            this.setState({
                translationLintErrors: lintErrors,
            });
        };

    render(): React.Node {
        const apiOptions = this.getApiOptions();
        const {KatexProvider} = getDependencies();

        if (this.reuseMarkdown) {
            return this.lastRenderedMarkdown;
        }

        const content = this.getContent(this.props, this.state);
        // `this.widgetIds` is appended to in `this.outputMarkdown`:
        this.widgetIds = [];

        if (this.shouldRenderJiptPlaceholder(this.props, this.state)) {
            // Crowdin's JIPT (Just in place translation) uses a fake language
            // with language tag "en-pt" where the value of the translations
            // look like: {crwdns2657085:0}{crwdne2657085:0} where it keeps the
            // {crowdinId:ngettext variant}. We detect whether the current
            // content matches this, so we can take over rendering of
            // the perseus content as the translators interact with jipt.
            // We search for only part of the tag that crowdin uses to guard
            // against them changing the format on us. The full tag it looks
            // for can be found in https://cdn.crowdin.net/jipt/jipt.js
            // globalPhrase var.

            // If we haven't already added this component to the registry do so
            // now. showHints() may cause this component to be rerendered
            // before jipt has a chance to replace its contents, so this check
            // will keep us from adding the component to the registry a second
            // time.
            if (!this.translationIndex) {
                this.translationIndex =
                    getDependencies().rendererTranslationComponents.addComponent(
                        this,
                    );
            }

            // For articles, we add jipt data to individual paragraphs. For
            // exercises, we add it to the renderer and let translators
            // translate the entire thing. For the article equivalent of
            // this if block, search this file for where we render a
            // QuestionParagraph, and see the `isJipt:` parameter sent to
            // PerseusMarkdown.parse()
            if (!apiOptions.isArticle) {
                // We now need to output this tag, as jipt looks for it to be
                // able to replace it with a translation that it runs an ajax
                // call to get.  We add a data attribute with the index to the
                // Persues.TranslationComponent registry so that when jipt
                // calls its before_dom_insert we can lookup this component by
                // this attribute and render the text with markdown.
                return (
                    <KatexProvider>
                        <DefinitionProvider>
                            <div
                                data-perseus-component-index={
                                    this.translationIndex
                                }
                            >
                                {content}
                            </div>
                        </DefinitionProvider>
                    </KatexProvider>
                );
            }
        }

        // Hacks:
        // We use mutable state here to figure out whether the output
        // had two columns.
        // It is updated to true by `this.outputMarkdown` if a
        // column break is found
        // TODO(aria): We now have a state variable threaded through
        // simple-markdown output. We should mutate it instead of
        // state on this component to do this in a less hacky way.
        this._isTwoColumn = false;

        // Parse the string of markdown to a parse tree
        const parsedMarkdown = PerseusMarkdown.parse(content, {
            // Recognize crowdin IDs while translating articles
            // (This should never be hit by exercises, though if you
            // decide you want to add a check that this is an article,
            // go for it.)
            isJipt: this.translationIndex != null,
        });

        // Optionally apply the linter to the parse tree
        if (this.props.linterContext.highlightLint) {
            // If highlightLint is true and lint is detected, this call
            // will modify the parse tree by adding lint nodes that will
            // serve to highlight the lint when rendered
            // $FlowFixMe[cannot-spread-inexact]
            const context: Context = {
                content: this.props.content,
                widgets: this.props.widgets,
                ...this.props.linterContext,
            };

            PerseusLinter.runLinter(parsedMarkdown, context, true);

            // Apply the lint errors from the last TranslationLinter run.
            // TODO(joshuan): Support overlapping dots.
            this._translationLinter.applyLintErrors(parsedMarkdown, [
                ...this.state.translationLintErrors,
                ...(this.props.legacyPerseusLint || []),
            ]);
        }

        // Render the linted markdown parse tree with React components
        const markdownContents = this.outputMarkdown(parsedMarkdown, {
            baseElements: apiOptions.baseElements,
        });

        const className = classNames({
            [ApiClassNames.RENDERER]: true,
            [ApiClassNames.RESPONSIVE_RENDERER]: true,
            [ApiClassNames.TWO_COLUMN_RENDERER]: this._isTwoColumn,
        });

        this.lastRenderedMarkdown = (
            <KatexProvider>
                <DefinitionProvider>
                    <div className={className}>{markdownContents}</div>
                </DefinitionProvider>
            </KatexProvider>
        );
        return this.lastRenderedMarkdown;
    }
}

const styles = {
    mobileZoomableParentFix: {
        // NOTE(abdul): There is an issue where transform animations will
        // cause the Zoomable component to disappear when running on the
        // native app on iPad (iOS 13). I found some answers online that recommend
        // transforming the parent in 3D space. Doing this forces hardware
        // acceleration, which causes the process to run on the GPU. It's not
        // clear to me why this fixes the issue, but it's suggested online
        // to people dealing with similar disappearance and flickering issues.
        transform: "translate3d(0,0,0)",
    },
};

export default Renderer;
