// @flow
/**
 * This widget is for embedding Khan Academy CS programs.
 */

import {StyleSheet, css} from "aphrodite";
import $ from "jquery";
import PropTypes from "prop-types";
import * as React from "react";
import _ from "underscore";

import {getDependencies} from "../dependencies.js";
import * as Changeable from "../mixins/changeable.jsx";
import {articleMaxWidthInPx} from "../styles/constants.js";
import Util from "../util.js";
import {isFileProtocol} from "../util/mobile-native-utils.js";
import {toAbsoluteUrl} from "../util/url-utils.js";

import type {WidgetExports} from "../types.js";

const {updateQueryString} = Util;

function getUrlFromProgramID(programID) {
    const {InitialRequestUrl} = getDependencies();

    const path =
        "/computer-programming/program/" +
        `${programID}/embedded?embed=yes&author=no`;
    // When loading scratchpads in our native apps, the current URL will exist
    // as a `file://` URL. In this case, we want to reference `ka.org` instead
    // of defaulting to what we get from `toAbsoluteUrl`.
    if (isFileProtocol(InitialRequestUrl.protocol)) {
        return `https://khanacademy.org${path}`;
    }

    return toAbsoluteUrl(path);
}

/* This renders the scratchpad in an iframe and handles validation via
 * window.postMessage */
class CSProgram extends React.Component<$FlowFixMe> {
    static propTypes = {
        ...Changeable.propTypes,
        programID: PropTypes.string,
        programType: PropTypes.oneOf(["pjs", "sql", "webpage"]),
        width: PropTypes.number,
        height: PropTypes.number,
        // eslint-disable-next-line react/forbid-prop-types
        settings: PropTypes.array,
        showEditor: PropTypes.bool,
        showButtons: PropTypes.bool,
        status: PropTypes.oneOf(["incomplete", "incorrect", "correct"]),
        message: PropTypes.string,
    };

    // The widget's grading function
    static validate(state: $FlowFixMe, rubric: $FlowFixMe): $FlowFixMe {
        // The iframe can tell us whether it's correct or incorrect,
        //  and pass an optional message
        if (state.status === "correct") {
            return {
                type: "points",
                earned: 1,
                total: 1,
                message: state.message || null,
            };
        }
        if (state.status === "incorrect") {
            return {
                type: "points",
                earned: 0,
                total: 1,
                message: state.message || null,
            };
        }
        return {
            type: "invalid",
            message: "Keep going, you're not there yet!",
        };
    }

    static defaultProps: $FlowFixMe = {
        showEditor: false,
        showButtons: false,
        status: "incomplete",
        // optional message
        message: null,
    };

    componentDidMount() {
        $(window).on("message", this.handleMessageEvent);
    }

    componentWillUnmount() {
        $(window).off("message", this.handleMessageEvent);
    }

    handleMessageEvent: ($FlowFixMe) => void = (e) => {
        // We receive data from the iframe that contains {passed: true/false}
        //  and use that to set the status
        // It could also contain an optional message
        let data = {};
        try {
            data = JSON.parse(e.originalEvent.data);
        } catch (err) {
            return;
        }

        if (_.isUndefined(data.testsPassed)) {
            return;
        }

        const status = data.testsPassed ? "correct" : "incorrect";
        this.change({
            status: status,
            message: data.message,
        });
    };

    change: (...args: $ReadOnlyArray<mixed>) => $FlowFixMe = (...args) => {
        // $FlowFixMe[incompatible-call]
        return Changeable.change.apply(this, args);
    };

    simpleValidate: ($FlowFixMe) => $FlowFixMe = (rubric) => {
        return CSProgram.validate(
            {
                status: this.props.status,
                message: this.props.message,
            },
            rubric,
        );
    };

    render(): React.Node {
        if (!this.props.programID) {
            return <div />;
        }

        let styleContainer = false;
        let url = getUrlFromProgramID(this.props.programID);
        let className;
        const style = {
            height: this.props.height,
            width: "100%",
        };

        if (this.props.showEditor) {
            url += "&editor=yes";
            className = "perseus-scratchpad-editor";
        } else {
            url += `&editor=no&width=${articleMaxWidthInPx}`;
            className = "perseus-scratchpad";
            if (this.props.programType !== "webpage") {
                styleContainer = true;
            }
        }

        if (this.props.showButtons) {
            url += "&buttons=yes";
            // Matches templates/scratchpads/embed_script.js
            // Toolbar height is 66, border height is 1 pixel
            style.height += 67;
        } else {
            url += "&buttons=no";
        }

        // Turn array of [{name: "", value: ""}] into object
        if (this.props.settings) {
            const settings = {};
            _.each(this.props.settings, function (setting) {
                if (setting.name && setting.value) {
                    settings[setting.name] = setting.value;
                }
            });
            // This becomes available to programs as Program.settings()
            url = updateQueryString(url, "settings", JSON.stringify(settings));
        }

        const sandboxOptions = [
            "allow-popups",
            "allow-same-origin",
            "allow-scripts",
            "allow-top-navigation",
        ].join(" ");

        // We sandbox the iframe so that we allowlist only the functionality
        //  that we need. This makes it a bit safer in case some content
        //  creator "went wild".
        // http://www.html5rocks.com/en/tutorials/security/sandboxed-iframes/
        return (
            <div
                className={css(
                    styles.widthOverride,
                    styleContainer && styles.container,
                )}
            >
                <iframe
                    sandbox={sandboxOptions}
                    src={url}
                    style={style}
                    className={className}
                    allowFullScreen={true}
                />
            </div>
        );
    }
}

const styles = StyleSheet.create({
    // Override the inherited width from the perseus paragraph class
    // 820 is minimum width for 420px editor and 400px canvas
    widthOverride: {
        width: 820,
    },
    container: {
        margin: "auto",
    },
});

export default ({
    name: "cs-program",
    displayName: "CS Program",
    supportedAlignments: ["block", "full-width"],
    widget: CSProgram,
    hidden: true,
}: WidgetExports<typeof CSProgram>);
