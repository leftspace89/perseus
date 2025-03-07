// @flow
import * as React from "react";

import type {CSSProperties} from "aphrodite";

type Props = {|
    value: string,
    onChange: (string) => void,
    className?: string,
    style?: CSSProperties,
|};

type State = {|
    value: string,
|};

/* You know when you want to propagate input to a parent...
 * but then that parent does something with the input...
 * then changing the props of the input...
 * on every keystroke...
 * so if some input is invalid or incomplete...
 * the input gets reset or otherwise effed...
 *
 * This is the solution.
 *
 * Enough melodrama. Its an input that only sends changes
 * to its parent on blur.
 */
// eslint-disable-next-line react/no-unsafe
class BlurInput extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {value: this.props.value};
    }

    UNSAFE_componentWillReceiveProps(nextProps: Props) {
        this.setState({value: nextProps.value});
    }

    handleChange: (e: $FlowFixMe) => void = (e) => {
        this.setState({value: e.target.value});
    };

    handleBlur: (e: $FlowFixMe) => void = (e) => {
        this.props.onChange(e.target.value);
    };

    render(): React.Element<"input"> {
        return (
            <input
                className={this.props.className}
                style={this.props.style}
                type="text"
                value={this.state.value}
                onChange={this.handleChange}
                onBlur={this.handleBlur}
            />
        );
    }
}

export default BlurInput;
