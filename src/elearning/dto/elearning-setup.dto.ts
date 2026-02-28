import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ArrayMinSize,
  ArrayUnique,
} from 'class-validator';

export enum ElearningSetupModeDto {
  NEW = 'NEW',
  EXISTING = 'EXISTING',
}

export enum ElearningEntityTypeDto {
  MATERIAL = 'MATERIAL',
  ASSIGNMENT = 'ASSIGNMENT',
  QUIZ = 'QUIZ',
}

export class SetupElearningClassDto {
  @IsInt()
  @Min(1)
  kelasPerkuliahanId: number;

  @IsEnum(ElearningSetupModeDto)
  setupMode: ElearningSetupModeDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  sourceKelasPerkuliahanId?: number;

  @IsOptional()
  @IsBoolean()
  isMergedClass?: boolean;

  @IsOptional()
  @IsBoolean()
  cloneContentAsHidden?: boolean;
}

export class MergeElearningClassesDto {
  @IsInt()
  @Min(1)
  masterKelasPerkuliahanId: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  memberKelasPerkuliahanIds: number[];
}

export class UnmergeElearningClassDto {
  @IsInt()
  @Min(1)
  kelasPerkuliahanId: number;
}

export class ToggleElearningVisibilityDto {
  @IsEnum(ElearningEntityTypeDto)
  entityType: ElearningEntityTypeDto;

  @IsString()
  entityId: string;

  @IsBoolean()
  isHidden: boolean;
}
