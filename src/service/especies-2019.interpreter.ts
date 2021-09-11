import { getLogger } from 'log4js';
import { RegiaoVegetal } from '../domain/regiao-vegetal.enum';
import { IterableString } from '../util/iterable-string';
import { EspecieMetaData } from './especies-2019-metadata/especie.meta-data';
import { FamiliaMetaData } from './especies-2019-metadata/familia.meta-data';
import { RegiaoMetaData } from './especies-2019-metadata/regiao.meta-data';
import { VegetacaoTipoMetaData } from './especies-2019-metadata/vegetacao-tipo.meta-data';

export class Especies2019Interpreter {

  private logger = getLogger();
  // private logger = console;

  regiaoMap: {
    [prop: string]: RegiaoVegetal;
  } = {
      'LITORAL SUL': RegiaoVegetal.SAO_PAULO_LITORAL_SUL,
      'LITORAL NORTE': RegiaoVegetal.SAO_PAULO_LITORAL_NORTE,
      'SUDESTE': RegiaoVegetal.SAO_PAULO_REGIAO_SUDESTE,
      'CENTRO': RegiaoVegetal.SAO_PAULO_REGIAO_CENTRO,
      'SUDOESTE': RegiaoVegetal.SAO_PAULO_REGIAO_SUDOESTE,
      'NOROESTE': RegiaoVegetal.SAO_PAULO_REGIAO_NOROESTE
    };

  // tslint:disable-next-line:cyclomatic-complexity
  interpret(listaEspecies2019File: string): RegiaoMetaData[] | null {
    const listaEspeciesDoc = new IterableString(listaEspecies2019File);

    const identificaRegiao = /^\s*#?\s*(REGIÃO(\n?)|LITORAL)[^\n]+\n/;
    const identificaVegetacaoTipo = /^\s*#?([^\n]+)\s*•/;
    const identificaFamilia = /^\s*[A-Z]+\s*\n/;

    const regioes: RegiaoMetaData[] = [];
    let regiao: RegiaoMetaData | null = null;
    let vegetacaoTipo: VegetacaoTipoMetaData | null = null;
    let familia: FamiliaMetaData | null = null;

    while (!listaEspeciesDoc.endContent()) {
      let result = '';

      if (result = listaEspeciesDoc.addCursor(identificaRegiao)) {
        regiao = this.registerRegiao(result, regioes, regiao);
      } else if (result = listaEspeciesDoc.addCursor(identificaVegetacaoTipo)) {
        vegetacaoTipo = this.registerVegetacaoTipo(result, regiao, vegetacaoTipo);
      } else if (result = listaEspeciesDoc.addCursor(identificaFamilia)) {
        familia = this.registerFamilia(result, vegetacaoTipo, familia);
      } else {
        this.registerEspecie(familia, listaEspeciesDoc);
      }
    }

    return regioes;
  }

  private registerRegiao(result: string, regioes: RegiaoMetaData[], regiao: RegiaoMetaData | null): RegiaoMetaData | null {
    const newRegiao = this.castTextToRegiao(result, regiao);
    if (newRegiao) {
      regioes.push(newRegiao);
      this.logger.info('região: ', regiao);
      return newRegiao;
    }

    return regiao;
  }

  private registerVegetacaoTipo(
    result: string, regiao: RegiaoMetaData | null, vegetacaoTipo: VegetacaoTipoMetaData | null
  ): VegetacaoTipoMetaData | null {
    const newVegetacaoTipo = this.castTextToVegetacaoTipo(result, vegetacaoTipo);

    if (!regiao) {
      this.logger.error('objeto região não foi encontrado para o tipo de vegetação. Vegetação tipo: ', vegetacaoTipo);
      return vegetacaoTipo;
    } else if (newVegetacaoTipo) {
      regiao.tipos.push(newVegetacaoTipo);
      this.logger.info('vegetação tipo: ', newVegetacaoTipo);
      return newVegetacaoTipo;
    }

    return vegetacaoTipo;
  }
  private registerFamilia(
    result: string, vegetacaoTipo: VegetacaoTipoMetaData | null, familia: FamiliaMetaData | null
  ): FamiliaMetaData | null {
    familia = this.castTextToFamilia(result);
    this.logger.info('família: ', familia);

    if (!vegetacaoTipo) {
      this.logger.error('objeto de tipo de vegetação não foi encontrado para a família. Família: ', familia);
    } else {
      vegetacaoTipo.familias.push(familia);
    }

    return familia;
  }

  private registerEspecie(familia: FamiliaMetaData | null, listaEspeciesDoc: IterableString): void {
    if (!familia) {
      this.logger.error('objeto de família não foi encontrado para a espécie.');
      return;
    }

    const ultimoEspecieInserido = familia.especies[familia.especies.length - 1];
    const especie = this.castIterableToEspecie(listaEspeciesDoc, ultimoEspecieInserido || null);
    this.logger.info('espécie: ', especie);
    familia.especies.push(especie);
  }

  private castTextToRegiao(result: string, regiao: RegiaoMetaData | null): RegiaoMetaData | null {
    const cleanResult = result.replace(/#|REGIÃO/g, '').trim();

    const regiaoTipo: RegiaoVegetal | undefined = this.regiaoMap[cleanResult];
    if (!regiaoTipo) {
      this.logger.warn('Região ignorada por estar fora do padrão esperada: ', result);
      return null;
    }

    if (regiaoTipo === regiao?.regiao) {
      return null;
    }

    return {
      regiao: regiaoTipo,
      tipos: []
    };
  }

  private castTextToVegetacaoTipo(result: string, vegetacaoTipo: VegetacaoTipoMetaData | null): VegetacaoTipoMetaData | null {
    let vegetacaoTipoNome = result.replace(/(#|•)/g, '').trim();
    const letrasSeparadasPorEspaco = /^([^ ]{1,2}[ ])+[^ ]$/;

    if (letrasSeparadasPorEspaco.test(vegetacaoTipoNome)) {
      vegetacaoTipoNome = vegetacaoTipoNome.replace(/ /g, '');
    }

    if (vegetacaoTipo?.nome === vegetacaoTipoNome) {
      return null;
    }

    return {
      nome: vegetacaoTipoNome,
      familias: []
    };
  }

  private castTextToFamilia(nome: string): FamiliaMetaData {
    return { nome, especies: [] };
  }

  //  FIXME: este método ficou muito gigante, ver a possibilidade de transforma-lo
  //  em um serviço independente com métodos menores
  // tslint:disable-next-line:cyclomatic-complexity
  private castIterableToEspecie(
    listaEspeciesDoc: IterableString,
    linhaEspecieUltimaInserida: EspecieMetaData | null
  ): EspecieMetaData {
    const especie: EspecieMetaData = {};

    const checkIfHasNoEspecieName = /^[ ]/;
    const ignoreAutoTrim = false;
    const hasEspecieName = !listaEspeciesDoc.spy(checkIfHasNoEspecieName, ignoreAutoTrim);
    const readAllUltilTwoSpaces = /^\s*([^\n ]+[ ])+[ ]/i;
    //  read all until two spaces or breakline
    const readAllUntilTwoSpacesOrBreakLine = /^\s*(([^\n ]+[ ])+[ ]|[^\n]+[ ]?\n)/i;
    const readAllUntilBreakLine = /^\n*[^\n]+\n/;

    if (hasEspecieName) {
      especie.nome = listaEspeciesDoc.addCursor(readAllUltilTwoSpaces);
      especie.type = 'full';

      if (!especie.nome) {
        especie.nome = listaEspeciesDoc.addCursor(readAllUntilBreakLine);
        this.setAsHeadAndTail(especie, linhaEspecieUltimaInserida);

        return especie;
      }
    } else {
      this.setAsHeadAndTail(especie, linhaEspecieUltimaInserida);
    }

    const readVegetacaoTamanho = /^[ ]+(\d|\(-)[\(\),\-\d]*[ ][ ]/;
    const vegetacaoTamanho = listaEspeciesDoc.addCursor(readVegetacaoTamanho);

    if (vegetacaoTamanho) {
      especie.tamanho = vegetacaoTamanho;
    } else {

      //  se o nome popular termina com quebra de linha,
      //  então nada mais deve ser acrescentado nesta espécia
      const nomePopular = listaEspeciesDoc.addCursor(readAllUntilTwoSpacesOrBreakLine, ignoreAutoTrim);
      especie.nomePopular = nomePopular.trim();
      if (nomePopular.match(/\n$/)) {
        return especie;
      }

      especie.tamanho = listaEspeciesDoc.addCursor(readVegetacaoTamanho);

      //  existem condições onde o tamanho está muito grudado ao nome popular
      //  o código abaixo irá verificar se está é uma situação deste tipo
      if (!especie.tamanho && especie.nomePopular) {
        //  FIXME: preciso reaproveitar a lógica de identificação de
        //  informações de tamanho por regex para manter uma manutenção centralizada
        const checkIfHasTamanhoInTheEnd = /(\d|\(-)[\(\),\-\d]$/;
        const hasTamanhoInTheEnd = especie.nomePopular.match(checkIfHasTamanhoInTheEnd);
        if (hasTamanhoInTheEnd) {
          const especieNomePopular = /.*[ ]/;
          const especieTamanho = /[ ][^ ]*$/;
          const tamanho = especie.nomePopular.replace(especieNomePopular, '');
          especie.nomePopular = especie.nomePopular.replace(especieTamanho, '');
          especie.tamanho = tamanho;
        }
      }
    }

    especie.classeSucessional = this.readClasseSucessional(listaEspeciesDoc);
    especie.grupoFuncional = this.readGrupoFuncional(listaEspeciesDoc);
    especie.sindromeDispersao = this.readSindromeDispersao(listaEspeciesDoc);

    const readBioma = /^[^\n]*\n/;
    especie.bioma = listaEspeciesDoc.addCursor(readBioma);

    return especie;
  }

  private setAsHeadAndTail(
    linhaEspecieTail: EspecieMetaData, linhaEspecieHead: EspecieMetaData | null
  ): void {
    if (linhaEspecieHead) {
      linhaEspecieHead.type = 'head';
    }
    linhaEspecieTail.type = 'tail';
  }

  private readClasseSucessional(listaEspeciesDoc: IterableString): string {
    const readClasseSucessional = /^\s*(P|NP|(P\/NP))/;
    return listaEspeciesDoc.addCursor(readClasseSucessional);
  }

  private readGrupoFuncional(listaEspeciesDoc: IterableString): string {
    const readGrupoFuncional = /^\s*(D|P)/;
    return listaEspeciesDoc.addCursor(readGrupoFuncional);
  }

  private readSindromeDispersao(listaEspeciesDoc: IterableString): string {
    const readSindromeDispersao = /^\s*(ANE|AUT|HIDR|ZOO)/;

    return listaEspeciesDoc.addCursor(readSindromeDispersao);
  }

}


// REGRAS DE COMO SEPARAR O NOME DA ESPÉCIE DO NOME POPULAR
//  1. no caso mais fácil haverá pelo menos dois espaços separando os nomes
//  2. se após coletar o texto, verificar que logo após se apresenta as medições da planta, regitrar um log
//     identificando o procedimento
//  3. se o próximo item for o nome popular, então ele é coletado; se forem as medições, então seguir:
//  4. nomes populares são conjuntos de caracteres sem espaços, separados por vírgulas, verificar se este padrão
//     ocorre na sentença anterior, se sim, extrair e coletar
//  5. verificar se a próxima linha é um registro incompleto, se sim, absorver estes registros, registrar um warning
//  6. se não houver nome popular identificado, registrar um warning

// PROBLEMAS
//  A informação de região nem sempre é precedida pela palavra REGIÃO e será confundida com um nome de familia
//                                                                            L I TOR A L S U L
//  Estou presumindo que o nome das familias não tem espaço no meio.
//  Considerando isso, se não houver quebra de linha logo após o conjunto de maiusculas, não é o nome de uma familia
//  Não é garantido, toda situação de maiusculas com espaço no meio deve ter um log de warning informando.

//  As espécies parciais não necessariamente fazem parte de uma não-parcial precedente. Existem situações onde
//  três linhas de espécie escrita com informações parciais se complementam

//  WARNINGS
//  Se a espécie só tiver caracteres maiusculos, gerar um warn
