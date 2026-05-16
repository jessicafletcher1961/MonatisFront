/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\model\RegleImportReleve.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\model\RegleImportReleve.java
 */
package fr.colline.monatis.importsreleves.model;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

import org.hibernate.annotations.NotFound;
import org.hibernate.annotations.NotFoundAction;

import fr.colline.monatis.comptes.model.CompteExterne;
import fr.colline.monatis.comptes.model.CompteInterne;
import fr.colline.monatis.references.model.Beneficiaire;
import fr.colline.monatis.references.model.SousCategorie;
import fr.colline.monatis.typologies.model.TypeOperation;
import jakarta.persistence.Column;
import jakarta.persistence.ConstraintMode;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
		name = "regle_import_releve",
		uniqueConstraints = {
				@UniqueConstraint(
						name = "uk_regle_import_releve_contexte",
						columnNames = { "compte_interne_contexte_id", "role_compte_externe", "cle_libelle_normalisee" })
		},
		indexes = {
				@Index(
						name = "idx_regle_import_releve_cle_role",
						columnList = "cle_libelle_normalisee, role_compte_externe"),
				@Index(
						name = "idx_regle_import_releve_derniere_utilisation",
						columnList = "date_derniere_utilisation")
		})
public class RegleImportReleve {

	@Id
	@GeneratedValue(generator = "gen_seq_regle_import_releve", strategy = GenerationType.SEQUENCE)
	@SequenceGenerator(name = "gen_seq_regle_import_releve", sequenceName = "seq_regle_import_releve", allocationSize = 1)
	private Long id;

	@Column(length = 140, nullable = false)
	private String cleLibelleNormalisee;

	@Column(length = 240)
	private String libelleExemple;

	@Enumerated(EnumType.STRING)
	@Column(length = 20, nullable = false)
	private RoleCompteExterneImport roleCompteExterne;

	@Column(length = 10, nullable = false)
	private TypeOperation typeOperation;

	@ManyToOne(fetch = FetchType.EAGER)
	@JoinColumn(name = "compte_interne_contexte_id", foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
	@NotFound(action = NotFoundAction.IGNORE)
	private CompteInterne compteInterneContexte;

	@ManyToOne(fetch = FetchType.EAGER)
	@JoinColumn(name = "compte_externe_id", foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
	@NotFound(action = NotFoundAction.IGNORE)
	private CompteExterne compteExterne;

	@ManyToOne(fetch = FetchType.EAGER)
	@JoinColumn(name = "sous_categorie_id", foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
	@NotFound(action = NotFoundAction.IGNORE)
	private SousCategorie sousCategorie;

	@ManyToMany(fetch = FetchType.EAGER)
	@JoinTable(
			name = "regle_import_releve_beneficiaire",
			joinColumns = @JoinColumn(name = "regle_import_releve_id", foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT)),
			inverseJoinColumns = @JoinColumn(name = "beneficiaire_id", foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT)))
	private Set<Beneficiaire> beneficiaires = new HashSet<>();

	@Column(nullable = false)
	private Long nombreUtilisations = 0L;

	@Column(nullable = false)
	private LocalDateTime dateDerniereUtilisation = LocalDateTime.now();

	@Column(nullable = false)
	private Boolean active = Boolean.TRUE;

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getCleLibelleNormalisee() {
		return cleLibelleNormalisee;
	}

	public void setCleLibelleNormalisee(String cleLibelleNormalisee) {
		this.cleLibelleNormalisee = cleLibelleNormalisee;
	}

	public String getLibelleExemple() {
		return libelleExemple;
	}

	public void setLibelleExemple(String libelleExemple) {
		this.libelleExemple = libelleExemple;
	}

	public RoleCompteExterneImport getRoleCompteExterne() {
		return roleCompteExterne;
	}

	public void setRoleCompteExterne(RoleCompteExterneImport roleCompteExterne) {
		this.roleCompteExterne = roleCompteExterne;
	}

	public TypeOperation getTypeOperation() {
		return typeOperation;
	}

	public void setTypeOperation(TypeOperation typeOperation) {
		this.typeOperation = typeOperation;
	}

	public CompteInterne getCompteInterneContexte() {
		return compteInterneContexte;
	}

	public void setCompteInterneContexte(CompteInterne compteInterneContexte) {
		this.compteInterneContexte = compteInterneContexte;
	}

	public CompteExterne getCompteExterne() {
		return compteExterne;
	}

	public void setCompteExterne(CompteExterne compteExterne) {
		this.compteExterne = compteExterne;
	}

	public SousCategorie getSousCategorie() {
		return sousCategorie;
	}

	public void setSousCategorie(SousCategorie sousCategorie) {
		this.sousCategorie = sousCategorie;
	}

	public Set<Beneficiaire> getBeneficiaires() {
		return beneficiaires;
	}

	public Long getNombreUtilisations() {
		return nombreUtilisations;
	}

	public void setNombreUtilisations(Long nombreUtilisations) {
		this.nombreUtilisations = nombreUtilisations;
	}

	public LocalDateTime getDateDerniereUtilisation() {
		return dateDerniereUtilisation;
	}

	public void setDateDerniereUtilisation(LocalDateTime dateDerniereUtilisation) {
		this.dateDerniereUtilisation = dateDerniereUtilisation;
	}

	public Boolean isActive() {
		return active;
	}

	public void setActive(Boolean active) {
		this.active = active;
	}

	public void incrementerUtilisation() {
		this.nombreUtilisations = this.nombreUtilisations == null ? 1L : this.nombreUtilisations + 1L;
		this.dateDerniereUtilisation = LocalDateTime.now();
	}

	public void changerBeneficiaires(Set<Beneficiaire> nouveauxBeneficiaires) {

		List<Beneficiaire> anciensBeneficiaires = new ArrayList<>(this.beneficiaires);

		List<Beneficiaire> aCreer = new ArrayList<>(nouveauxBeneficiaires);
		aCreer.removeAll(anciensBeneficiaires);
		for (Beneficiaire beneficiaire : aCreer) {
			this.beneficiaires.add(beneficiaire);
		}

		List<Beneficiaire> aSupprimer = new ArrayList<>(anciensBeneficiaires);
		aSupprimer.removeAll(nouveauxBeneficiaires);
		for (Beneficiaire beneficiaire : aSupprimer) {
			this.beneficiaires.remove(beneficiaire);
		}
	}

	@Override
	public int hashCode() {
		return Objects.hash(id, cleLibelleNormalisee, roleCompteExterne, compteInterneContexte);
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj)
			return true;
		if (obj == null)
			return false;
		if (getClass() != obj.getClass())
			return false;
		RegleImportReleve other = (RegleImportReleve) obj;
		return Objects.equals(id, other.id)
				&& Objects.equals(cleLibelleNormalisee, other.cleLibelleNormalisee)
				&& roleCompteExterne == other.roleCompteExterne
				&& Objects.equals(compteInterneContexte, other.compteInterneContexte);
	}
}

