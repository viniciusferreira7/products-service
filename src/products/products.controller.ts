import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { CreateProductDto } from './dtos/create-product.dto';
import { ProductResponseDto } from './dtos/product-response.dto';
import { ProductsService } from './products.service';

/**
 * The reads are a public catalog; creating needs a seller token. Routes are
 * matched in declaration order, so static and prefixed ones go before `:id`:
 * a one-segment static route declared after it (say `featured`) would be
 * taken for an id.
 */
@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List active products',
    description: 'Newest first. No token needed.',
  })
  @ApiOkResponse({ type: ProductResponseDto, isArray: true })
  async listActive(): Promise<ProductResponseDto[]> {
    const products = await this.productsService.findActive();

    return products.map((product) => ProductResponseDto.from(product));
  }

  @Get('seller/:sellerId')
  @Public()
  @ApiOperation({
    summary: "List a seller's active products",
    description:
      'Newest first. An empty list when the seller has none. No token needed.',
  })
  @ApiOkResponse({ type: ProductResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'The seller id is not a UUID' })
  async listActiveBySeller(
    @Param('sellerId', ParseUUIDPipe) sellerId: string
  ): Promise<ProductResponseDto[]> {
    const products = await this.productsService.findActiveBySeller(sellerId);

    return products.map((product) => ProductResponseDto.from(product));
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Get an active product by id',
    description: 'An inactive product answers 404. No token needed.',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiBadRequestResponse({ description: 'The id is not a UUID' })
  @ApiNotFoundResponse({ description: 'No active product has this id' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<ProductResponseDto> {
    const product = await this.productsService.findActiveById(id);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return ProductResponseDto.from(product);
  }

  @Post()
  @Roles(UserRole.SELLER)
  @ApiBearerAuth('JWT-auth')
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
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
