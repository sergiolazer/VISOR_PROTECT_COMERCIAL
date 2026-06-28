import type { Request, Response, NextFunction } from 'express';
import type { IShopRepository } from '../../domain/repositories/IShopRepository';
import { AlertValidationError } from '../../domain/errors/AlertValidationError';
import { AlertSenderValidator } from '../../application/validators/AlertSenderValidator';

export class NetworkController {
  constructor(
    private readonly shopRepository: IShopRepository,
    private readonly alertSenderValidator: AlertSenderValidator,
  ) {}

  listCityShops = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const city = typeof req.query.city === 'string' ? req.query.city : '';
      if (!city.trim()) {
        res.status(400).json({ message: 'Parámetro city requerido', code: 'CITY_REQUIRED' });
        return;
      }

      const shopId = req.user?.shopId;
      if (!shopId) {
        res.status(401).json({ message: 'Sesión inválida', code: 'TOKEN_INVALID' });
        return;
      }

      const authorizedCity = await this.alertSenderValidator.validateCityForShop(shopId, city);
      const shops = await this.shopRepository.findNetworkByCity(authorizedCity);

      res.json({
        city: authorizedCity,
        shops,
      });
    } catch (error) {
      if (error instanceof AlertValidationError) {
        res.status(403).json({ message: error.message, code: error.code });
        return;
      }
      next(error);
    }
  };
}
