import {IsDateString, IsIn, IsNotEmpty, IsString, IsUrl, ValidateIf} from "class-validator";

export class AddShareRequestDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsIn(['LINK', 'FILE'])
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
}