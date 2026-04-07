import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { OrganizationToken } from '@prisma/client';
import { Response } from 'express';
import { CONST } from 'src/common';
import { GetOrganizationToken } from '../client/decorator';
import { GetUser } from '../user/decorator';
import { AuthService } from './auth.service';
import {
  Alert,
  ChangePasswordDto,
  ForgetPasswordDto,
  LoginDto,
  RegisterClientDto,
  RegisterDto,
  SocialDtop,
  TotpBaseDto,
  TotpDto,
  TotpEnableDto,
} from './dto';
import {
  ApiOrSwayGuard,
  OrganizationGuard,
  OrganizationOrSwayauthGuard,
  PermissionGuard,
  SwayGuard,
  UserGuard,
} from './guard';
import { ScopeGuard } from './guard/scope.guard';
import { JWTProp } from './type';

@Controller({ version: '1', path: 'auth' })
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('facebook')
  renderFacebookConcentScreen(
    @Res() res: Response,
    @Query() params: SocialDtop,
  ) {
    return res.render('social', {
      type: 'facebook',
      oauthUrlBase: CONST.FACEBOOK_OAUTH_URL,
      alert: params.alert == Alert.on,
    });
  }

  @Get('google')
  renderGoogleConcentScreen(@Res() res: Response, @Query() params: SocialDtop) {
    return res.render('social', {
      type: 'google',
      oauthUrlBase: CONST.GOOGLE_OAUTH_URL,
      alert: params.alert == Alert.on,
    });
  }

  @Post('login/user')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new PermissionGuard('read'))
  @UseGuards(new ScopeGuard('manual'))
  @UseGuards(OrganizationGuard)
  userLogin(
    @Body() dto: LoginDto,
    @GetOrganizationToken() orgToken: OrganizationToken,
    @Ip() ip_address: string,
  ) {
    return this.authService.loginUser(dto, orgToken, ip_address);
  }

  @Post('login/client')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiOrSwayGuard)
  clientLogin(@Body() dto: LoginDto, @Ip() ip_address: string) {
    return this.authService.loginClient(dto, ip_address);
  }

  @Post('login/admin')
  @HttpCode(HttpStatus.OK)
  adminLogin(@Body() dto: LoginDto, @Ip() ip_address: string) {
    return this.authService.loginAdmin(dto, ip_address);
  }

  @Post('register/user')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new ScopeGuard('manual'))
  @UseGuards(OrganizationGuard)
  registerUser(
    @Body() dto: RegisterDto,
    @GetOrganizationToken() orgToken: OrganizationToken,
    @Ip() ip_address: string,
  ) {
    return this.authService.registerUser(dto, orgToken, ip_address);
  }

  @Post('register/resend-code')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new ScopeGuard('manual'))
  @UseGuards(OrganizationGuard)
  registerResend(
    @Body() dto: ForgetPasswordDto,
    @GetOrganizationToken() orgToken: OrganizationToken,
  ) {
    return this.authService.registerResend(dto, 'user', orgToken);
  }

  @Post('register/client')
  @UseGuards(SwayGuard)
  @HttpCode(HttpStatus.CREATED)
  registerClient(@Body() dto: RegisterClientDto, @Ip() ip_address: string) {
    return this.authService.registerClient(dto, ip_address);
  }

  @Post('register/resend-client-code')
  @UseGuards(SwayGuard)
  @HttpCode(HttpStatus.CREATED)
  registerResendClient(@Body() dto: ForgetPasswordDto) {
    return this.authService.registerResend(dto, 'client');
  }

  @Post('register/verify')
  @HttpCode(HttpStatus.OK)
  registerVerify(@Body() dto: TotpDto) {
    return this.authService.registerVerify(dto);
  }

  @Post('forgot-password/user')
  @UseGuards(OrganizationGuard)
  @HttpCode(HttpStatus.OK)
  forgetUserPassword(
    @Body() dto: ForgetPasswordDto,
    @GetOrganizationToken() orgToken: OrganizationToken,
  ) {
    return this.authService.forgotUserPassword(dto, orgToken);
  }

  @Post('forgot-password/client')
  @UseGuards(SwayGuard)
  @HttpCode(HttpStatus.OK)
  forgetClientPassword(@Body() dto: ForgetPasswordDto) {
    return this.authService.forgotClientPassword(dto);
  }

  @Get('token/verify')
  @UseGuards(OrganizationOrSwayauthGuard)
  @HttpCode(HttpStatus.OK)
  tokenVerify(@Query() param: TotpBaseDto) {
    return this.authService.tokenVerify(param);
  }

  @Patch('forgot-password/new-password')
  @UseGuards(OrganizationOrSwayauthGuard)
  @HttpCode(HttpStatus.OK)
  forgetPasswordNewPassword(@Body() dto: ChangePasswordDto) {
    return this.authService.forgetPasswordNewPassword(dto);
  }

  @Get('2fa/list')
  @UseGuards(UserGuard)
  @HttpCode(HttpStatus.OK)
  get2AuthAllowed(@GetUser() user: JWTProp) {
    return this.authService.get2AuthAllowed(user);
  }

  @Post('2fa/enable')
  @UseGuards(UserGuard)
  @HttpCode(HttpStatus.CREATED)
  totpEnable(@Body() dto: TotpEnableDto, @GetUser() user: JWTProp) {
    return this.authService.twoFactorEnable(dto, user);
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  totpVerify(@Body() dto: TotpBaseDto) {
    return this.authService.twoFactorVerify(dto);
  }
}
