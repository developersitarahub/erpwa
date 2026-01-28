/**
 * ===============================
 * WHATSAPP CATALOG TEMPLATE HELPER
 * ===============================
 * 
 * Multi-Product Catalog Templates allow sending up to 30 products
 * from your WhatsApp Business Catalog in a single message template.
 * 
 * Meta/WhatsApp Limits:
 * - Maximum 250 templates per WhatsApp Business Account (WABA)
 * - Maximum 30 products per catalog message
 * - All templates require Meta approval before use
 * - Catalog ID must be linked to your WhatsApp Business Account
 */

/**
 * Create a Multi-Product Catalog Template Component
 * 
 * @param {Array} productIds - Array of product IDs from your catalog (max 30)
 * @returns {Object} Catalog template component for Meta API
 */
export function createCatalogComponent(productIds) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
        throw new Error('Product IDs array is required');
    }

    if (productIds.length > 30) {
        throw new Error('Maximum 30 products allowed per catalog template');
    }

    return {
        type: 'CATALOG',
        parameters: {
            thumbnail_product_retailer_id: productIds[0], // First product as thumbnail
            product_retailer_ids: productIds, // All products
        },
    };
}

/**
 * Create a Carousel Catalog Template (Multi-Card)
 * Each card can showcase different products
 * 
 * @param {Array} cards - Array of card objects with product IDs
 * @returns {Object} Carousel component for Meta API
 */
export function createCarouselCatalogComponent(cards) {
    if (!Array.isArray(cards) || cards.length === 0) {
        throw new Error('Cards array is required');
    }

    if (cards.length > 10) {
        throw new Error('Maximum 10 cards allowed in carousel');
    }

    return {
        type: 'CAROUSEL',
        cards: cards.map((card, index) => ({
            card_index: index,
            components: [
                {
                    type: 'HEADER',
                    format: 'IMAGE',
                    example: {
                        header_handle: [card.imageHandle], // Image uploaded to Meta
                    },
                },
                {
                    type: 'BODY',
                    text: card.bodyText,
                    example: {
                        body_text: card.exampleVariables || [],
                    },
                },
                {
                    type: 'BUTTONS',
                    buttons: card.buttons || [],
                },
            ],
        })),
    };
}

/**
 * Validate catalog template requirements
 * 
 * @param {Object} template - Template data
 * @returns {Object} Validation result
 */
export function validateCatalogTemplate(template) {
    const errors = [];

    if (!template.catalogId) {
        errors.push('Catalog ID is required for catalog templates');
    }

    if (template.templateType === 'catalog') {
        if (!template.catalogProducts || template.catalogProducts.length === 0) {
            errors.push('At least one product is required');
        }

        if (template.catalogProducts && template.catalogProducts.length > 30) {
            errors.push('Maximum 30 products allowed per catalog template');
        }
    }

    if (template.templateType === 'carousel') {
        if (!template.carouselCards || template.carouselCards.length === 0) {
            errors.push('At least one carousel card is required');
        }

        if (template.carouselCards && template.carouselCards.length > 10) {
            errors.push('Maximum 10 carousel cards allowed');
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Get template type display name
 */
export const TEMPLATE_TYPES = {
    standard: {
        name: 'Standard Message',
        description: 'Regular text, image, or video template',
        maxCount: 250,
    },
    catalog: {
        name: 'Multi-Product Catalog',
        description: 'Showcase up to 30 products from your catalog',
        maxCount: 250,
        maxProducts: 30,
    },
    carousel: {
        name: 'Carousel (Multi-Card)',
        description: 'Up to 10 cards with images and buttons',
        maxCount: 250,
        maxCards: 10,
    },
};

export default {
    createCatalogComponent,
    createCarouselCatalogComponent,
    validateCatalogTemplate,
    TEMPLATE_TYPES,
};
