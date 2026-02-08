import { basicSetup } from 'codemirror';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { oneDarkHighlightStyle, oneDarkTheme } from '@codemirror/theme-one-dark';
import { tags as t } from '@lezer/highlight';
import { autocompletion } from '@codemirror/autocomplete';

const customHighlightStyle = HighlightStyle.define([
  {
    tag: [t.labelName],
    color: '#e06c75',
  },
]);
const customOneDark = [
  oneDarkTheme,
  syntaxHighlighting(customHighlightStyle),
  syntaxHighlighting(oneDarkHighlightStyle),
];

const MONGO_OPERATORS = [
  // Query operators
  '$gt', '$gte', '$lt', '$lte', '$eq', '$ne',
  '$in', '$nin', '$exists', '$type', '$regex', '$options',
  '$and', '$or', '$not', '$nor',
  '$elemMatch', '$size', '$all',
  '$mod', '$text', '$search', '$where',
  // Update operators
  '$set', '$unset', '$inc', '$push', '$pull', '$addToSet',
  '$pop', '$rename', '$min', '$max', '$mul', '$currentDate',
  // Aggregation stages
  '$match', '$group', '$sort', '$project', '$unwind',
  '$lookup', '$limit', '$skip', '$count', '$facet',
  '$bucket', '$bucketAuto', '$sortByCount',
  '$addFields', '$replaceRoot', '$replaceWith',
  '$merge', '$out', '$sample', '$unionWith',
  '$graphLookup', '$redact',
  // Aggregation expressions
  '$sum', '$avg', '$first', '$last',
  '$arrayElemAt', '$concatArrays', '$filter', '$map',
  '$reduce', '$slice', '$cond', '$ifNull',
  '$switch', '$concat', '$substr', '$toLower', '$toUpper',
  '$dateToString', '$year', '$month', '$dayOfMonth',
];

export function createMongoCompletion(fieldNames) {
  return function mongoCompletion(context) {
    // Match word starting with $ or a regular word
    const word = context.matchBefore(/[\w$]+/);
    if (!word && !context.explicit) return null;

    const completions = [];

    // Add operators
    for (const op of MONGO_OPERATORS) {
      completions.push({ label: op, type: 'keyword', boost: 1 });
    }

    // Add field names if provided
    if (fieldNames && fieldNames.length > 0) {
      for (const field of fieldNames) {
        completions.push({ label: field, type: 'variable', boost: 2 });
      }
    }

    return {
      from: word ? word.from : context.pos,
      options: completions,
      validFor: /^[\w$]*$/,
    };
  };
}

const editor = (textarea, options) => {
  const extensions = [
    basicSetup,
    history(),
    lineNumbers(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    javascript(),
    indentUnit.of(' '),
    EditorState.readOnly.of(options.readOnly),
    customOneDark,
  ];

  // Add autocompletion if requested
  if (options.completions) {
    const fieldNames = options.completions.fields || [];
    extensions.push(autocompletion({
      override: [createMongoCompletion(fieldNames)],
    }));
  }

  const state = EditorState.create({
    doc: textarea.value,
    extensions,
  });
  const view = new EditorView();
  view.setState(state);
  textarea.parentNode.insertBefore(view.dom, textarea);
  textarea.style.display = 'none';
  if (textarea.form) {
    textarea.form.addEventListener('submit', () => {
      textarea.value = view.state.doc.toString();
    });
  }
  view.isClean = () => state.doc.eq(view.state.doc);
  return view;
};
export default editor;
