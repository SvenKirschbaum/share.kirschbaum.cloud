import {IsDateString, IsIn, IsNotEmpty, IsNumber, IsPositive, IsString, IsUrl, ValidateIf} from "class-validator";

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
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @ValidateIf(object => object.type === 'FILE')
    @IsNumber()
    @IsPositive()
    fileSize: number;

    @ValidateIf(object => object.type === 'FILE')
    @IsString()
    @IsNotEmpty()
    fileType: string;
}