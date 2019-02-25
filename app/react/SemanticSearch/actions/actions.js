import { actions } from 'app/BasicReducer';

import api from '../SemanticSearchAPI';

export function fetchSearches() {
  return dispatch => api.getAllSearches()
  .then((response) => {
    dispatch(actions.set('semanticSearch/searches', response));
  });
}

export function selectSemanticSearchDocument(doc) {
  return dispatch => dispatch(actions.set('semanticSearch/selectedDocument', doc));
}

export function submitNewSearch(args) {
  return dispatch => api.search(args)
  .then(() => {
    dispatch(fetchSearches());
  });
}

export function deleteSearch(searchId) {
  return dispatch => api.deleteSearch(searchId)
  .then(() => {
    dispatch(fetchSearches());
  });
}
