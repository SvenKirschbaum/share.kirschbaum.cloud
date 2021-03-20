const charset = Array.from("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
export const getRandomId = () => {
    const output = new Array(6);

    for (let i = 0; i < output.length; i++) {
        output[i] = charset[Math.floor(Math.random() * charset.length)];
    }

    return output.join('');
};