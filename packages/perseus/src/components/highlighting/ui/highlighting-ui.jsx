// @flow
/**
 * This component, given a set of DOMHighlights, draws highlight rectangles in
 * the same absolute position as the highlighted content, as computed by the
 * range's `getClientRects` method.
 *
 * TODO(mdr): Many things can affect the correct positioning of highlighting,
 *     and this component does not attempt to anticipate them. If we start
 *     using this highlighting library on content with a more dynamic layout,
 *     we should add a hook to allow the parent to `forceUpdate` the
 *     `HighlightingUI`.
 */
import * as i18n from "@khanacademy/wonder-blocks-i18n";
import * as React from "react";

import {rangesOverlap} from "../ranges.js";

import HighlightSetRenderer from "./highlight-set-renderer.jsx";
import HighlightTooltip from "./highlight-tooltip.jsx";
import SelectionTracker from "./selection-tracker.jsx";

import type {TrackedSelection} from "./selection-tracker.jsx";
import type {
    DOMHighlight,
    DOMHighlightSet,
    DOMRange,
    ZIndexes,
} from "./types.js";

type HighlightingUIProps = {|
    // A function that builds a DOMHighlight from the given DOMRange, if
    // possible. If it would not currently be valid to add a highlight over the
    // given DOMRange, returns null.
    buildHighlight: (range: DOMRange) => ?DOMHighlight,

    // A Node that contains the highlightable content.
    contentNode: Node,

    // Whether the highlights are user-editable. If false, highlights are
    // read-only.
    editable: boolean,

    // A set of highlights to render.
    highlights: DOMHighlightSet,

    // This component's `offsetParent` element, which is the nearest ancestor
    // with `position: relative`. This will enable us to choose the correct
    // CSS coordinates to align highlights and tooltips with the target
    // content.
    offsetParent: Element,

    // A callback indicating that the user would like to add the given
    // highlight to the current set of highlights.
    onAddHighlight: (range: DOMHighlight) => mixed,

    // A callback indicating that the user would like to remove the highlight
    // with the given key.
    onRemoveHighlight: (highlightKey: string) => mixed,

    // The z-indexes to use when rendering tooltips above content, and
    // highlights below content.
    zIndexes: ZIndexes,
|};

class HighlightingUI extends React.PureComponent<HighlightingUIProps> {
    _handleAddHighlight(highlightToAdd: DOMHighlight) {
        this.props.onAddHighlight(highlightToAdd);

        // Deselect the newly-highlighted text, by collapsing the selection
        // to the end of the range.
        const selection = document.getSelection();
        if (selection) {
            selection.collapseToEnd();
        }
    }

    _selectionIsValid(trackedSelection: ?TrackedSelection): boolean {
        if (!trackedSelection) {
            return false;
        }

        const {contentNode} = this.props;

        // Create a range over the content node.
        const contentRange = new Range();
        contentRange.selectNodeContents(contentNode);

        // Create a range over the focus position.
        const focusRange = new Range();
        focusRange.setStart(
            trackedSelection.focusNode,
            trackedSelection.focusOffset,
        );
        focusRange.collapse(true /* to start */);

        // Determine whether the content range contains the focus, by checking
        // whether they intersect. Because the focus range is a single point,
        // intersection is equivalent to being fully contained.
        const contentContainsFocus = rangesOverlap(contentRange, focusRange);

        // If the content contains the focus, this is a valid selection. Some
        // parts of the range might go beyond the content, but that's okay; the
        // corresponding DOMHighlight is already trimmed to only contain valid
        // words. We're just checking that the tooltip we render will be inside
        // the content, because rendering a tooltip outside the content would
        // be weird.
        const selectionIsValid = contentContainsFocus;

        return selectionIsValid;
    }

    render(): React.Node {
        return (
            <SelectionTracker
                buildHighlight={this.props.buildHighlight}
                enabled={this.props.editable}
            >
                {(trackedSelection, userIsMouseSelecting) => (
                    <div>
                        <HighlightSetRenderer
                            editable={
                                /* An existing highlight is editable when the
                                 * component is in editable mode, and there's no
                                 * selection in progress. */
                                this.props.editable &&
                                !this._selectionIsValid(trackedSelection)
                            }
                            highlights={this.props.highlights}
                            offsetParent={this.props.offsetParent}
                            onRemoveHighlight={this.props.onRemoveHighlight}
                            zIndexes={this.props.zIndexes}
                        />
                        {this._selectionIsValid(trackedSelection) &&
                            !userIsMouseSelecting && (
                                <HighlightTooltip
                                    label={i18n._("Add highlight")}
                                    onClick={() =>
                                        this._handleAddHighlight(
                                            // TODO(mdr): We found a new Flow error when upgrading:
                                            //     "proposedHighlight (Cannot get `trackedSelection.proposedHighlight` because property `proposedHighlight` is missing in null or undefined [1].)"
                                            // $FlowFixMe[incompatible-use](0.57.3->0.75.0)
                                            trackedSelection.proposedHighlight,
                                        )
                                    }
                                    // TODO(mdr): We found a new Flow error when upgrading:
                                    //     "focusNode (Cannot get `trackedSelection.focusNode` because property `focusNode` is missing in null or undefined [1].)"
                                    // $FlowFixMe[incompatible-use](0.57.3->0.75.0)
                                    focusNode={trackedSelection.focusNode}
                                    // TODO(mdr): We found a new Flow error when upgrading:
                                    //     "focusOffset (Cannot get `trackedSelection.focusOffset` because property `focusOffset` is missing in null or undefined [1].)"
                                    // $FlowFixMe[incompatible-use](0.57.3->0.75.0)
                                    focusOffset={trackedSelection.focusOffset}
                                    offsetParent={this.props.offsetParent}
                                />
                            )}
                    </div>
                )}
            </SelectionTracker>
        );
    }
}

export default HighlightingUI;
