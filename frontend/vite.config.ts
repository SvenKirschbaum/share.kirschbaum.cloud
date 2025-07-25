import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import svgrPlugin from 'vite-plugin-svgr';
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), svgrPlugin(), basicSsl()],
    server: {
        port: 3000,
        // Required to work with oauth provider
        https: {},
    },
    preview: {
        port: 3000
    },
    build: {
        outDir: 'build'
    }
});
