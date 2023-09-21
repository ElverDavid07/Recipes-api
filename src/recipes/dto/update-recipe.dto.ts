import { PartialType } from '@nestjs/mapped-types';
import {
  ArrayNotEmpty,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { CreateRecipeDto } from './create-recipe.dto';
import { Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRecipeDto extends PartialType(CreateRecipeDto) {
  @IsNotEmpty({ message: 'El nombre es requerido!' })
  @IsString({ message: 'El nombre debe ser un texto!' })
  name?: string;

  @IsNotEmpty({ message: 'La descripción es requerida!' })
  @IsString({ message: 'La descripción debe ser un texto!' })
  description?: string;

  @IsNotEmpty({ message: 'Los lista de ingredientes es requerida!' })
  @IsArray({
    message: 'Los ingredientes deben ser proporcionados como una lista!',
  })
  @ArrayNotEmpty({ message: 'La lista de ingredientes no puede estar vacía!' })
  ingredients?: string[];

  @IsNotEmpty({ message: 'La lista de pasos es requerida!' })
  @IsArray({ message: 'Los pasos deben ser proporcionados como una lista!' })
  @ArrayNotEmpty({ message: 'La lista de pasos no puede estar vacía!' })
  steps?: string[];

  @IsOptional()
  @IsMongoId({ message: 'Country tiene que ser de tipo objectId' })
  @ApiProperty({
    description:
      'Agrege el id de la nueva region que con la que se desea relacionar la receta',
  })
  country?: Types.ObjectId;

  @IsNotEmpty({ message: 'La categoría es requerida' })
  @IsMongoId({ message: 'Category tiene que ser de tipo objectId' })
  @ApiProperty({
    description:
      'Agrege el id de la nueva categoria con la que se desea relacionar la receta',
  })
  category?: Types.ObjectId;

  @ApiProperty({
    description:
      'Al actualizar una imagen debe de tener en cuenta que la nueva imagen sea de cualquiera de estos tipo png,svg,jpg,jpge,webp,avif , la url que estaba en la base de datos se actualizara y se guardara la nueva url de la nueva imagen',
  })
  image?: string;

  @ApiProperty({
    description:
      'Esta propiedad se agregara automaticamente al guardarse una imagen , sirve para poder encontrar la imagen en el servicio de cloudinary y poder actualizar la imagen',
  })
  public_id?: string;
}
