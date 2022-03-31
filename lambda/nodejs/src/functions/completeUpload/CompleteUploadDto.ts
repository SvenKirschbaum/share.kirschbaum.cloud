import {ArrayNotEmpty, IsArray, IsObject} from "class-validator";
import {CompletedPart} from "@aws-sdk/client-s3";

export class CompleteUploadDto {
    @IsArray()
    @ArrayNotEmpty()
    @IsObject({each: true})
    parts: CompletedPart[];
}