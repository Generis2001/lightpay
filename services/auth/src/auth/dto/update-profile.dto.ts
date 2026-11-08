import { IsString, Length } from "class-validator";

export class UpdateProfileDto {
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @IsString()
  @Length(1, 100)
  lastName!: string;
}
