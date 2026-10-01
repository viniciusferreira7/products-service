import { Body, Controller, Post, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { CreateProductDto } from './dtos/create-product.dto';
import { ProductResponseDto } from './dtos/product-response.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.SELLER)
  @ApiOperation({
    summary: 'Create a product',
    description:
      'Sellers only. The product belongs to the seller in the token and starts active; sellerId and isActive are not accepted in the body.',
  })
  @ApiCreatedResponse({
    type: ProductResponseDto,
    description: 'Product created',
  })
  @ApiBadRequestResponse({ description: 'The body failed validation' })
  @ApiForbiddenResponse({ description: 'The user is not a seller' })
  async create(
    @Body() dto: CreateProductDto,
    @Req() request: { user: AuthenticatedUser }
  ): Promise<ProductResponseDto> {
    const product = await this.productsService.create(dto, request.user.id);

    return ProductResponseDto.from(product);
  }
}
