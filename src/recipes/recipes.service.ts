import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cache } from 'cache-manager';
import * as fse from 'fs-extra';
import { Model } from 'mongoose';
import { deleteImage, uploadImage } from 'src/utils/cloudinary.config';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { SearchRecipeDto } from './dto/search-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { Recipe } from './entities/recipe.entity';

@Injectable()
export class RecipesService {
  constructor(
    @InjectModel(Recipe.name) private RecipeEntity: Model<Recipe>,
    @Inject('CACHE_MANAGER') private cacheManager: Cache,
  ) {}

  private cacheKey = '';
  private generateCacheKey(page: number, limit: number): string {
    return `recipes_list_page_${page}_${limit}`;
  }

  private async deleteCacheByKey(cacheKey: string): Promise<void> {
    await this.cacheManager.del(cacheKey);
  }

  /**
   * Servicio para obtener todas las recetas
   * @param page - pagina actual
   * @param limit - catidad de recetas por pagina
   * @returns Lista de las recetas
   * @throws {HttpException} Si la pagina no existe o es menor o igual a 0
   */
  async findAll(page: number, limit: number) {
    //Generar cacheKey
    this.cacheKey = this.generateCacheKey(page, limit);
    //Obtener las recetas de la cache si existe
    const cacheData = await this.cacheManager.get(this.cacheKey);
    //Obtener el total de recetas agregadas a la DB
    const totalRecipes = await this.RecipeEntity.countDocuments();
    //Total de paginas
    const totalPages = Math.ceil(totalRecipes / limit);
    //Si page es menor que uno o mayor que el valor de totalPages entonce error 404
    if (page < 1 || page > totalPages) {
      throw new HttpException('Página no encontrada', HttpStatus.NOT_FOUND);
    }
    //Si no hay datos en cache entoce se agregan
    if (!cacheData) {
      const skip = (page - 1) * limit;
      const recipes = await this.RecipeEntity.find()
        .skip(skip)
        .limit(limit)
        .populate('category', '-public_id')
        .select('-public_id')
        .sort({ createdAt: -1 });

      const recipePageData = {
        page,
        totalPages,
        totalRecipes,
        data: recipes,
      };
      await this.cacheManager.set(this.cacheKey, recipePageData);

      return {
        page,
        totalPages,
        totalRecipes,
        data: recipes,
      };
    }

    return cacheData;
  }

  /**
   * Servicio para obtener receta por id
   * @param id - Id de la receta que se desea buscar
   * @returns Receta especifica buscada
   * @throws {HttpException} si la receta no existe
   */

  async findOne(id: string) {
    const recipe = await this.RecipeEntity.findById(id)
      .populate('category', '-public_id')
      .select('-public_id');

    //Si la receta no existe entonces error 404
    if (!recipe) {
      throw new HttpException('La receta no existe!', HttpStatus.NOT_FOUND);
    }

    return recipe;
  }

  /**
   * obtener las ultimas recetas agregadas
   * @returns Lista de las ultimas  recetas
   */
  async getLatestRecipes(limit: number) {
    return await this.RecipeEntity.find().limit(limit).sort({ createdAt: -1 });
  }

  /**
   * Servicio para buscar receta por nombre
   * @param name - Nombre de la receta que desea buscar
   * @returns Lista de recetas que tengan el nombre buscado
   * @throws Mensaje que indica que no hay recetas relacionadas con el nombre buscado
   */
  async searchByName(searchRecipeDto: SearchRecipeDto) {
    const query = { name: { $regex: searchRecipeDto.name, $options: 'i' } };

    const recipes = await this.RecipeEntity.find(query)
      .populate('category', '-public_id')
      .select('-public_id')
      .sort({ createdAt: -1 });
    if (recipes.length === 0) {
      return { message: 'No se encontraron recetas con ese nombre.' };
    }
    return recipes;
  }

  /**
   *  Servicio para obtener o filtrar todas las recetas de una categoría específica.
   * @param categoryId - ID de la categoría por la cual deseas filtrar las recetas.
   * @returns Lista de todas las recetas asociada a esa categoria
   * @throws Mensaje que indica que no hay recetas asociadas a esa catrgoria
   */
  async getRecipesByCategory(categoryId: string) {
    const recipes = await this.RecipeEntity.find({
      category: categoryId,
    })
      .select('-public_id')
      .populate('category', '-public_id')
      .exec();

    if (recipes.length === 0) {
      return { message: 'No hay recetas en esta categoria' };
    }
    return recipes;
  }

  /**
   * Servicio para crea una nueva receta con los detalles proporcionados y la imagen asociada.
   * @param createRecipeDto - Datos de la receta a crear.
   * @param image - Imagen asociada a la receta.
   * @returns Un mensaje de éxito y el nombre de la receta creada.
   * @throws {HttpException} Si ocurre un error durante el proceso de creación.
   */
  async create(createRecipeDto: CreateRecipeDto, image: Express.Multer.File) {
    try {
      //Eliminar la cache
      if (this.cacheKey) {
        await this.deleteCacheByKey(this.cacheKey);
        this.cacheKey = '';
      }
      //subir imagen a cloudinary y eliminarla de la carpeta upload
      const cloudinaryResponse = await uploadImage(image.path, 'recipes');
      await fse.unlink(image.path);
      //crear la receta y guardarla en la DB
      const newRecipe = new this.RecipeEntity({
        ...createRecipeDto,
        image: cloudinaryResponse.secure_url,
        public_id: cloudinaryResponse.public_id,
      });
      newRecipe.save();

      return {
        message: 'Receta creada correctamente',
        name: createRecipeDto.name,
      };
    } catch (error) {
      console.log(error);
      throw new HttpException(
        'Error al crear la receta',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Servicio para actualizar una receta ya existente
   * @param id - Id de la receta que se desea actualizar
   * @param updateRecipeDto - Datos actualizados de la receta.
   * @param image - si la imagen de la receta se desea actualiza
   * @returns Un mensaje de éxito y el nombre de la receta actualizada.
   * @throws {HttpException} Si la receta no existe.
   *  */
  async update(
    id: string,
    updateRecipeDto: UpdateRecipeDto,
    image: Express.Multer.File,
  ) {
    //Si la recetas no existe error 404
    const recipeFound = await this.RecipeEntity.findById(id);
    if (!recipeFound) {
      throw new HttpException('La receta no existe!', HttpStatus.NOT_FOUND);
    }
    //Eliminar cache
    if (this.cacheKey) {
      await this.deleteCacheByKey(this.cacheKey);
      this.cacheKey = '';
    }
    //actualizar la imagen
    if (image) {
      await deleteImage(recipeFound.public_id);
      const newImage = await uploadImage(image.path, 'recipes');
      await fse.unlink(image.path);
      updateRecipeDto.image = newImage.secure_url;
      updateRecipeDto.public_id = newImage.public_id;
    }
    //receta actualizada
    await this.RecipeEntity.findByIdAndUpdate(id, updateRecipeDto);

    return {
      message: 'Receta actualizada correctamente',
      name: updateRecipeDto.name,
    };
  }

  /**
   * Servicio para eliminar una receta existente.
   * @param id - ID de la receta que se desea eliminar.
   * @returns Un mensaje de éxito y el nombre de la receta eliminada.
   * @throws {HttpException} Si la receta no existe.
   */
  async remove(id: string) {
    //Si la receta no existe error 404
    const recipeFound = await this.RecipeEntity.findById(id);
    if (!recipeFound) {
      throw new HttpException('La receta no existe!', HttpStatus.NOT_FOUND);
    }
    //Eliminar cache
    if (this.cacheKey) {
      await this.deleteCacheByKey(this.cacheKey);
      this.cacheKey = '';
    }
    //Eliminar receta y eliminar imagen de cloudinary
    await deleteImage(recipeFound.public_id);
    await this.RecipeEntity.findByIdAndDelete(id);
    return {
      message: 'Receta eliminada correctamente',
      name: recipeFound.name,
    };
  }
}
