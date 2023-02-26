export const selectShares = (state) => state.shares.shares;
export const selectShareById = (state, shareId) => state.shares.shares.find((share => share.id === shareId));
export const selectShareState = (state) => state.shares.state;
export const selectShareError = (state) => state.shares.error;
export const selectShareAddState = (state) => state.shares.add.state;
export const selectShareAddError = (state) => state.shares.add.error;
export const selectShareAddId = (state) => state.shares.add.id;
