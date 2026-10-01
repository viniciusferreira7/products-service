import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const NAME_MAX_LENGTH = 255;
export const PRICE_MIN = 0.01;
/** The largest value the `decimal(10,2)` column holds. */
export const PRICE_MAX = 99999999.99;

/** At least one non-whitespace character. */
const NOT_BLANK = /\S/;

/**
 * Single-line text that Postgres can store and that encodes to UTF-8: no
 * control characters (NUL is rejected by Postgres with 22021) and no lone
 * UTF-16 surrogates.
 */
const SINGLE_LINE_TEXT = /^[^\p{Cc}\p{Cs}]*$/u;

/** Like `SINGLE_LINE_TEXT`, but tabs and line breaks are allowed. */
const MULTI_LINE_TEXT = /^(?:[^\p{Cc}\p{Cs}]|[\t\n\r])*$/u;

/**
 * The body of `POST /products`. `sellerId` comes from the token and
 * `isActive` is always true, so neither is accepted here: the global
 * ValidationPipe answers 400 to any property not declared below.
 */
export class CreateProductDto {
  @ApiProperty({ example: 'Mechanical keyboard', maxLength: NAME_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @Matches(NOT_BLANK, { message: 'name must not be blank' })
  @Matches(SINGLE_LINE_TEXT, {
    message: 'name must not contain control characters or line breaks',
  })
  @MaxLength(NAME_MAX_LENGTH)
  name: string;

  @ApiProperty({ example: 'Hot-swappable, 75% layout' })
  @IsString()
  @Matches(NOT_BLANK, { message: 'description must not be blank' })
  @Matches(MULTI_LINE_TEXT, {
    message: 'description must not contain control characters',
  })
  description: string;

  @ApiProperty({
    example: 349.9,
    minimum: PRICE_MIN,
    maximum: PRICE_MAX,
    description: 'At most 2 decimal places',
  })
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
    { message: 'price must be a number with at most 2 decimal places' }
  )
  @Min(PRICE_MIN)
  @Max(PRICE_MAX)
  price: number;

  @ApiProperty({ example: 10, minimum: 0 })
  @IsInt()
  @Min(0)
  stock: number;
}
