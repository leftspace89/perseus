// @flow
/**
 * A version of the `math-input` subrepo's KeypadInput component that adheres to
 * the same API as Perseus's  MathOuput and NumberInput, allowing it to be
 * dropped in as a replacement for those components without any modifications.
 *
 * TODO(charlie): Once the keypad API has stabilized, move this into the
 * `math-input` subrepo and use it everywhere as a simpler, keypad-coupled
 * interface to `math-input`'s MathInput component.
 */

import {
    KeypadInput,
    KeypadTypes,
    keypadElementPropType,
} from "@khanacademy/math-input";
import PropTypes from "prop-types";
import * as React from "react";

export default class SimpleKeypadInput extends React.Component<$FlowFixMe> {
    componentDidMount() {
        // TODO(scottgrant): This is a hack to remove the deprecated call to
        // this.isMounted() but is still considered an anti-pattern.
        this._isMounted = true;
    }

    componentWillUnmount() {
        this._isMounted = false;
    }

    _isMounted: boolean = false;

    focus() {
        // $FlowFixMe[object-this-reference]
        this.refs.input.focus(); // eslint-disable-line react/no-string-refs
    }

    blur() {
        // $FlowFixMe[object-this-reference]
        this.refs.input.blur(); // eslint-disable-line react/no-string-refs
    }

    getValue(): string | number {
        return this.props.value;
    }

    render(): React.Node {
        // $FlowFixMe[object-this-reference]
        const _this = this;
        // Intercept the `onFocus` prop, as we need to configure the keypad
        // before continuing with the default focus logic for Perseus inputs.
        // Intercept the `value` prop so as to map `null` to the empty string,
        // as the `KeypadInput` does not support `null` values.
        const {keypadElement, onFocus, value, ...rest} = _this.props;

        return (
            <KeypadInput
                // eslint-disable-next-line react/no-string-refs
                ref="input"
                keypadElement={keypadElement}
                onFocus={() => {
                    if (keypadElement) {
                        keypadElement.configure(
                            {
                                keypadType: KeypadTypes.FRACTION,
                            },
                            () => {
                                if (_this._isMounted) {
                                    onFocus && onFocus();
                                }
                            },
                        );
                    } else {
                        onFocus && onFocus();
                    }
                }}
                value={value == null ? "" : "" + value}
                {...rest}
            />
        );
    }
}

SimpleKeypadInput.propTypes = {
    keypadElement: keypadElementPropType,
    onFocus: PropTypes.func,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
