import { getPlaceholder } from '../../scripts/utils/placeholders.js';

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
    getPlaceholder('formSubmit', 'Submit'),
    getPlaceholder('formHoneypotSuccess', 'Thank you!'),
    getPlaceholder('formSuccess', 'Thank you! Your submission has been received.'),
    getPlaceholder('formSending', 'Sending…'),
    getPlaceholder('formError', 'Something went wrong. Please try again.'),
    getPlaceholder('formSelectPlaceholder', 'Select {label}'),
    getPlaceholder('formRequired', 'This field is required'),
    getPlaceholder('formRequiredCheckbox', 'This field must be checked'),
    getPlaceholder('formInvalidEmail', 'Enter a valid email'),
    getPlaceholder('formInvalidValue', 'Enter a valid value'),
    getPlaceholder('formPatternMismatch', 'Please match the requested format'),
    getPlaceholder('formTooShort', 'Enter at least {min} characters'),
  ]);
  return {
    submitText,
    honeypotSuccessMsg,
    successMsg,
    sendingText,
    errorMsg,
    selectPlaceholder: (label) => selectPlaceholderTpl.replace('{label}', label),
    required: requiredMsg,
    requiredCheckbox: requiredCheckboxMsg,
    invalidEmail: invalidEmailMsg,
    invalidValue: invalidValueMsg,
    patternMismatch: patternMismatchMsg,
    tooShort: (min) => tooShortTpl.replace('{min}', min),
  };
};
