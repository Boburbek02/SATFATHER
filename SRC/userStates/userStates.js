const userStates = new Map();

module.exports = {
  setUserState: (chatId, key, value) => {
    const state = userStates.get(chatId) || {};
    state[key] = value;
    userStates.set(chatId, state);
  },
  getUserState: (chatId, key) => {
    const state = userStates.get(chatId) || {};
    return state.hasOwnProperty(key) ? state[key] : null;

  },
  clearUserState: (chatId) => {
    userStates.delete(chatId);
  },
};
