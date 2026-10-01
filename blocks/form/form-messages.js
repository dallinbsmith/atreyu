import { getPlaceholder, fillPlaceholder } from '../../scripts/utils/placeholders.js';

// Every user-facing string this block needs, resolved once via a single
// Promise.all and handed to form.js — which passes the result down into
// makeField()/validate() rather than making either of those async
// themselves, since neither needs to await anything else. submitText/
// honeypotSuccessMsg/successMsg/sendingText/errorMsg are form.js's own
// concern; the rest drive makeField()'s select placeholder and
// form-fields.js's validate()/messageFor().
export const getMessages = async () => {
  const [
    submitText, honeypotSuccessMsg, successMsg, sendingText, errorMsg,
    selectPlaceholderTpl, requiredMsg, requiredCheckboxMsg, invalidEmailMsg,
    invalidValueMsg, patternMismatchMsg, tooShortTpl,
  ] = await Promise.all([
    getPlaceholder('forms.submit', 'Submit'),
    getPlaceholder('forms.honeypotSuccess', 'Thank you!'),
    getPlaceholder('forms.success', 'Thank you! Your submission has been received.'),
    getPlaceholder('forms.sending', 'Sending…'),
    getPlaceholder('forms.error', 'Something went wrong. Please try again.'),
    getPlaceholder('forms.selectPlaceholder', 'Select {label}'),
    getPlaceholder('forms.required', 'This field is required'),
    getPlaceholder('forms.requiredCheckbox', 'This field must be checked'),
    getPlaceholder('forms.invalidEmail', 'Enter a valid email'),
    getPlaceholder('forms.invalidValue', 'Enter a valid value'),
    getPlaceholder('forms.patternMismatch', 'Please match the requested format'),
    getPlaceholder('forms.tooShort', 'Enter at least {min} characters'),
  ]);
  return {
    submitText,
    honeypotSuccessMsg,
    successMsg,
    sendingText,
    errorMsg,
    selectPlaceholder: (label) => fillPlaceholder(selectPlaceholderTpl, { label }),
    required: requiredMsg,
    requiredCheckbox: requiredCheckboxMsg,
    invalidEmail: invalidEmailMsg,
    invalidValue: invalidValueMsg,
    patternMismatch: patternMismatchMsg,
    tooShort: (min) => fillPlaceholder(tooShortTpl, { min }),
  };
};
