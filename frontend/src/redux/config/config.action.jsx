import {createAsyncThunk} from "@reduxjs/toolkit";
import axios from "axios";

export const fetchConfig = createAsyncThunk('config/fetchConfig', async () => {
    const response = await axios.get('/config.json');

    return response.data
});
