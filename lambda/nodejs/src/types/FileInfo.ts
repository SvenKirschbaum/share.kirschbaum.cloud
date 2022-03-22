import {IsNotEmpty, IsNumber, IsPositive, IsString, ValidateIf} from "class-validator";

export default class FileInfo {
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsNumber()
    @IsPositive()
    fileSize: number;

    @IsString()
    @IsNotEmpty()
    fileType: string;
}