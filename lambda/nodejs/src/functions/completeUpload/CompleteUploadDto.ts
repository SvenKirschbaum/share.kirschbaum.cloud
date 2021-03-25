import {S3} from "aws-sdk";
import {ArrayNotEmpty, IsArray, IsObject} from "class-validator";

export class CompleteUploadDto {
    @IsArray()
    @ArrayNotEmpty()
    @IsObject({each: true})
    parts: S3.CompletedPart[];
}