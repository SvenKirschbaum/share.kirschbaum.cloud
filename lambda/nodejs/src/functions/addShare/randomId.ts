const charset = Array.from("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
export const getRandomId = (length = 6) => {
    const output = new Array(length);

    for (let i = 0; i < output.length; i++) {
        output[i] = charset[Math.floor(Math.random() * charset.length)];
    }

    return output.join('');
};