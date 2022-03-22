import {
    IsBoolean,
    IsDateString,
    IsIn,
    IsNotEmpty,
    IsNumber,
    IsPositive,
    IsString,
    IsUrl,
    ValidateIf
} from "class-validator";
import FileInfo from "../../types/FileInfo";

export class AddShareRequestDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsIn(['LINK', 'FILE', 'FILE_REQUEST'])
    type: string;

    @IsDateString()
    expires: string;

    @ValidateIf(object => object.type === 'LINK')
    @IsString()
    @IsNotEmpty()
    @IsUrl({
        require_protocol: true
    })
    link: string;

    @ValidateIf(object => object.type === 'FILE')
    file: FileInfo

    @ValidateIf(object => object.type === 'FILE_REQUEST')
    @IsBoolean()
    notifyOnUpload: boolean = false;
}