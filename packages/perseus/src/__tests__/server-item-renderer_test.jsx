// @flow

import {RenderStateRoot} from "@khanacademy/wonder-blocks-core";
import {within, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import "@testing-library/jest-dom"; // Imports custom matchers

import {testDependencies} from "../../../../testing/test-dependencies.js";
import {
    itemWithInput,
    mockedItem,
} from "../__testdata__/item-renderer_testdata.js";
import * as Dependencies from "../dependencies.js";
import WrappedServerItemRenderer, {
    ServerItemRenderer,
} from "../server-item-renderer.jsx";
import {registerWidget} from "../widgets.js";
import InputNumberExport from "../widgets/input-number.jsx";
import RadioWidgetExport from "../widgets/radio.jsx";

import MockAssetLoadingWidgetExport, {
    MockAssetLoadingWidget,
    mockedAssetItem,
} from "./mock-asset-loading-widget.jsx";
import MockWidgetExport from "./mock-widget.jsx";

import type {PerseusItem} from "../perseus-types.js";
import type {APIOptions} from "../types.js";

// This looks alot like `widgets/__tests__/renderQuestion.jsx', except we use
// the ServerItemRenderer instead of Renderer
const renderQuestion = (
    question: PerseusItem,
    apiOptions: APIOptions = Object.freeze({}),
    optionalProps: $Shape<
        React.ElementConfig<typeof WrappedServerItemRenderer>,
    > = Object.freeze({}),
): {|
    container: HTMLElement,
    renderer: ServerItemRenderer,
|} => {
    let renderer: ServerItemRenderer | null = null;

    const {container} = render(
        <RenderStateRoot>
            <WrappedServerItemRenderer
                ref={(node) => (renderer = node)}
                apiOptions={apiOptions}
                item={question}
                problemNum={0}
                reviewMode={false}
                {...optionalProps}
            />
        </RenderStateRoot>,
    );
    if (!renderer) {
        throw new Error(`Failed to render!`);
    }
    return {container, renderer};
};

describe("server item renderer", () => {
    beforeAll(() => {
        registerWidget("input-number", InputNumberExport);
        registerWidget("radio", RadioWidgetExport);
        registerWidget("mock-widget", MockWidgetExport);
    });

    beforeEach(() => {
        jest.spyOn(Dependencies, "getDependencies").mockReturnValue(
            testDependencies,
        );
    });

    afterEach(() => {
        // The Renderer uses a timer to wait for widgets to complete rendering.
        // If we don't spin the timers here, then the timer fires in the test
        // _after_ and breaks it because we do setState() in the callback,
        // and by that point the component has been unmounted.
        jest.runOnlyPendingTimers();
    });

    it("should snapshot", () => {
        // Arrange and Act
        const {container} = renderQuestion({
            ...itemWithInput,
            hints: [
                {content: "Hint #1", images: {}, widgets: {}},
                {content: "Hint #2", images: {}, widgets: {}},
                {content: "Hint #3", images: {}, widgets: {}},
            ],
        });

        // Assert
        expect(container).toMatchSnapshot("initial render");
    });

    it("should render the content", () => {
        // Arrange and Act
        renderQuestion(itemWithInput);

        // Assert
        expect(screen.getByRole("textbox")).toBeVisible();
    });

    it("should be invalid if no input provided", () => {
        // Arrange
        const {renderer} = renderQuestion(itemWithInput);

        // Act
        const score = renderer.scoreInput();

        // Assert
        expect(score.correct).toBe(false);
        expect(score.empty).toBe(true);
    });

    it("should be answerable", () => {
        // Arrange
        const {renderer} = renderQuestion(itemWithInput);
        userEvent.type(screen.getByRole("textbox"), "-42");

        // Act
        const score = renderer.scoreInput();

        // Assert
        expect(score.correct).toBe(true);
        expect(score.empty).toBe(false);
    });

    it("calls onInteraction callback", () => {
        // Arrange
        const interactionCallback = jest.fn();
        renderQuestion(itemWithInput, {
            interactionCallback,
        });

        // Act
        userEvent.type(screen.getByRole("textbox"), "-42");
        jest.runOnlyPendingTimers(); // Renderer uses setTimeout setting widget props

        // Assert
        expect(interactionCallback).toHaveBeenCalled();
    });

    it("should set the input value for a widget", () => {
        // Arrange
        const focus = jest.fn();
        const {renderer} = renderQuestion(itemWithInput);

        // Act
        renderer.setInputValue(["input-number 1"], "99", focus);

        // Assert
        expect(
            renderer.scoreWidgets()["input-number 1"].guess.currentValue,
        ).toBe("99");
    });

    it("should return the DOM node for the requested focus path", async () => {
        // Arrange
        const {renderer} = renderQuestion(itemWithInput);

        // Act
        const node = renderer.getDOMNodeForPath(["input-number 1"]);

        // Assert
        // $FlowIgnore[incompatible-call]: node could be null or Text
        expect(await within(node).findAllByRole("textbox")).toHaveLength(1);
    });

    it("should return the grammar type for the requested focus path", () => {
        // Arrange
        const {renderer} = renderQuestion(itemWithInput);

        // Act
        const grammarType = renderer.getGrammarTypeForPath(["input-number 1"]);

        // Assert
        expect(grammarType).toBe("number");
    });

    it("should return the number of hints available", () => {
        // Arrange
        const {renderer} = renderQuestion({
            ...itemWithInput,
            hints: [
                {content: "Hint #1", images: {}, widgets: {}},
                {content: "Hint #2", images: {}, widgets: {}},
                {content: "Hint #3", images: {}, widgets: {}},
            ],
        });

        // Act
        const numHints = renderer.getNumHints();

        // Assert
        expect(numHints).toBe(3);
    });

    it("should return all widget ids", () => {
        // Arrange
        const {renderer} = renderQuestion(mockedItem);

        // Act
        const widgetIds = renderer.getWidgetIds();

        // Assert
        expect(widgetIds).toStrictEqual([
            "mock-widget 1",
            "mock-widget 2",
            "mock-widget 3",
            "mock-widget 4",
        ]);
    });

    it("should call the answerable callback when no widgets are empty", () => {
        // Arrange
        const answerableCallback = jest.fn();
        const {rerender} = render(
            <RenderStateRoot>
                <ServerItemRenderer
                    apiOptions={{
                        answerableCallback,
                    }}
                    item={itemWithInput}
                    problemNum={0}
                    reviewMode={false}
                />
            </RenderStateRoot>,
        );
        userEvent.type(screen.getByRole("textbox"), "-42");

        // Act
        rerender(
            <RenderStateRoot>
                <ServerItemRenderer
                    apiOptions={{
                        answerableCallback,
                    }}
                    item={itemWithInput}
                    problemNum={1} // to force componentDidUpdate
                    reviewMode={false}
                />
                ,
            </RenderStateRoot>,
        );

        // Assert
        expect(answerableCallback).toHaveBeenCalledWith(true);
    });

    it("should call the onRendered callback when all assets loaded", () => {
        // This is an involved test. We create a mock widget that gives us
        // access to the setAssetStatus function that is passed down by the
        // render tree created.
        // Finally we re-render and poke the asset status to loaded. At that
        // everything is loaded.

        // Arrange
        registerWidget("mocked-asset-widget", MockAssetLoadingWidgetExport);

        const onRendered = jest.fn();
        let renderer: ?ServerItemRenderer;
        const {rerender} = render(
            <RenderStateRoot>
                <ServerItemRenderer
                    ref={(component) => (renderer = component)}
                    item={mockedAssetItem}
                    problemNum={0}
                    reviewMode={false}
                    onRendered={onRendered}
                />
            </RenderStateRoot>,
        );
        if (renderer == null) {
            throw new Error("Renderer failed to render.");
        }

        const mockedWidget = renderer.questionRenderer.getWidgetInstance(
            "mocked-asset-widget 1",
        );
        if (mockedWidget == null) {
            throw new Error("Couldn't find mocked widget!");
        }

        rerender(
            <RenderStateRoot>
                <ServerItemRenderer
                    item={mockedAssetItem}
                    problemNum={1}
                    reviewMode={false}
                    onRendered={onRendered}
                />
            </RenderStateRoot>,
        );

        // Act
        // setAssetStatus() is not part of the Widget interface, it's specific
        // this test.
        const widget = ((mockedWidget: any): MockAssetLoadingWidget);
        widget.setAssetStatus("ABC", true);

        // Assert
        expect(onRendered).toHaveBeenCalledWith(true);
    });

    describe("focus management", () => {
        it("calls onFocusChange when focusing the renderer", () => {
            // Arranged
            const onFocusChange = jest.fn();
            const {renderer} = renderQuestion(itemWithInput, {
                onFocusChange,
            });

            // Act
            const gotFocus = renderer.focus();
            // We have _two_ different async processes that need to be resolved here
            jest.runOnlyPendingTimers();
            jest.runOnlyPendingTimers();

            // Assert
            expect(gotFocus).toBeTrue();
            expect(onFocusChange).toHaveBeenCalledWith(
                ["input-number 1"],
                null,
                undefined,
                expect.any(Object),
            );
        });

        it("activates the keypadElement when focusing the renderer on mobile", () => {
            // Arranged
            const onFocusChange = jest.fn();
            const keypadElementDOMNode = <div />;
            const keypadElement = {
                getDOMNode: jest
                    .fn()
                    .mockImplementation(() => keypadElementDOMNode),
                activate: jest.fn(),
            };
            const {renderer} = renderQuestion(
                itemWithInput,
                {onFocusChange, isMobile: true},
                {keypadElement},
            );

            // Act
            const gotFocus = renderer.focus();
            // We have _two_ different async processes that need to be resolved here
            jest.runOnlyPendingTimers();
            jest.runOnlyPendingTimers();

            // Assert
            expect(keypadElement.activate).toHaveBeenCalled();
            expect(gotFocus).toBeTrue();
            expect(onFocusChange).toHaveBeenCalledWith(
                ["input-number 1"],
                null,
                keypadElementDOMNode,
                expect.any(Object),
            );
        });

        it("calls onFocusChange when blurring the renderer", () => {
            // Arrange
            const onFocusChange = jest.fn();
            const {renderer} = renderQuestion(itemWithInput, {
                onFocusChange,
            });
            renderer.focus();
            // We have _two_ different async processes that need to be resolved here
            jest.runOnlyPendingTimers();
            jest.runOnlyPendingTimers();

            // Act
            renderer.blur();
            // We have _two_ different async processes that need to be resolved here
            jest.runOnlyPendingTimers();
            jest.runOnlyPendingTimers();

            // Assert
            expect(onFocusChange).toHaveBeenCalledTimes(2);
            expect(onFocusChange).toHaveBeenLastCalledWith(
                null,
                ["input-number 1"],
                null,
                null,
            );
        });

        it("dismisses the keypadElement when blurring the renderer on mobile", () => {
            // Arranged
            const onFocusChange = jest.fn();
            const keypadElementDOMNode = <div />;
            const keypadElement = {
                getDOMNode: jest
                    .fn()
                    .mockImplementation(() => keypadElementDOMNode),
                activate: jest.fn(),
                dismiss: jest.fn(),
            };
            const {renderer} = renderQuestion(
                itemWithInput,
                {onFocusChange, isMobile: true},
                {keypadElement},
            );
            renderer.focus();
            // We have _two_ different async processes that need to be resolved here
            jest.runOnlyPendingTimers();
            jest.runOnlyPendingTimers();

            // Act
            renderer.blur();
            // We have _two_ different async processes that need to be resolved here
            jest.runOnlyPendingTimers();
            jest.runOnlyPendingTimers();

            // Assert
            expect(keypadElement.dismiss).toHaveBeenCalled();
            expect(onFocusChange).toHaveBeenCalledTimes(2);
            expect(onFocusChange).toHaveBeenLastCalledWith(
                null,
                ["input-number 1"],
                null,
                null,
            );
        });

        it("should focus the widget requested in focusPath()", () => {
            // Arrange
            const onFocusChange = jest.fn();
            const {renderer} = renderQuestion(itemWithInput, {
                onFocusChange,
            });

            // Act
            renderer.focusPath(["input-number 1"]);

            // Assert
            expect(onFocusChange).toHaveBeenCalledWith(
                ["input-number 1"],
                null,
                undefined,
                expect.any(Object),
            );
        });
    });

    describe("state serialization", () => {
        it("should serialize the current state", () => {
            // Arrange
            const {renderer} = renderQuestion({
                ...itemWithInput,
                hints: [
                    {content: "Hint #1", images: {}, widgets: {}},
                    {content: "Hint #2", images: {}, widgets: {}},
                    {content: "Hint #3", images: {}, widgets: {}},
                ],
            });
            userEvent.type(screen.getByRole("textbox"), "-42");

            // Act
            const state = renderer.getSerializedState();

            // Assert
            expect(state).toMatchInlineSnapshot(`
                {
                  "hints": [
                    {},
                    {},
                    {},
                  ],
                  "question": {
                    "input-number 1": {
                      "answerType": "number",
                      "currentValue": "-42",
                      "rightAlign": undefined,
                      "simplify": "required",
                      "size": "normal",
                    },
                  },
                }
            `);
        });

        it("should restore serialized state", () => {
            // Arrange
            const callback = jest.fn();
            const {renderer} = renderQuestion(itemWithInput);

            // Act
            renderer.restoreSerializedState(
                {
                    hints: [{}, {}, {}],
                    question: {
                        "input-number 1": {
                            answerType: "number",
                            currentValue: "-42",
                            rightAlign: undefined,
                            simplify: "required",
                            size: "normal",
                        },
                    },
                },
                callback,
            );
            jest.runOnlyPendingTimers();

            // Assert
            expect(callback).toHaveBeenCalled();
            expect(screen.getByRole("textbox")).toHaveValue("-42");
        });
    });
});
