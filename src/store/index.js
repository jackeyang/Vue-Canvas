import Vue from 'vue';
import Vuex from 'vuex';


import myCanvas from './modules/my-canvas';
import createLogger from '../plugins/logger';

Vue.use(Vuex);

const debug = process.env.NODE_ENV !== 'production';


export default new Vuex.Store({
    modules: {
        myCanvas,
    },
    strict: debug,
    plugins: debug ? [createLogger()] : [],
});
