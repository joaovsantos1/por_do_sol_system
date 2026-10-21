namespace Pdv.Domain.Entities;

/// <summary>
/// Configuração única (singleton) das taxas cobradas pela maquininha de
/// cartão. Sempre existe exatamente UMA linha nessa tabela — não é por
/// produto nem por período, é a taxa vigente agora. Quando o Administrador
/// muda a taxa, só afeta vendas fechadas DAQUI PRA FRENTE; vendas já
/// fechadas mantêm o ValorLiquido calculado com a taxa vigente na hora
/// (ver Pagamento.ValorLiquido), então o histórico nunca muda retroativamente.
/// </summary>
public class ConfiguracaoTaxas : EntidadeBase
{
    public decimal TaxaCartaoCreditoPercentual { get; set; }
    public decimal TaxaCartaoDebitoPercentual { get; set; }

    public bool TaxaServicoAtiva { get; set; }
    public decimal TaxaServicoPercentual { get; set; } = 10m;
}