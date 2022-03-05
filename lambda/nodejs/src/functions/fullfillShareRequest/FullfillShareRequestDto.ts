import {IsNotEmpty, IsNumber, IsPositive, IsString} from "class-validator";

export class FullfillShareRequestDto {
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