import * as types from 'app/Viewer/actions/actionTypes';

const initialState = {pages: [], css: []};

export default function template(state = initialState, action = {}) {
  if (action.type === types.SET_DOCUMENT) {
    return action.document;
  }

  return state;
}
