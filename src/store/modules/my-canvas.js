import * as types from '../mutation-types';

const state = {
  markState: false,
  markResult: [],
};


const getters = {
  

};

const actions = {

};


const mutations = {
  [types.CHANGE_MARK_STATE](state, markState) {
    state.markState = markState;
  },
  

};

export default {
  state,
  getters,
  actions,
  mutations
}