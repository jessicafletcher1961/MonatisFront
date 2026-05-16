/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\operations\controller\request\OperationPageRequestDto.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\operations\controller\request\OperationPageRequestDto.java
 */
package fr.colline.monatis.operations.controller.request;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.List;

public class OperationPageRequestDto implements Serializable {

	private static final long serialVersionUID = 8033781279358222394L;

	public Integer numeroPage;
	public Integer taillePage;
	public String recherche;
	public String codeTypeOperation;
	public List<String> codesTypeOperation;
	public LocalDate depuisLe;
	public LocalDate jusqueAu;
	public Long montantEnCentimes;
	public String identifiantCompteRecetteOuDepense;
	public String identifiantCompteRecette;
	public String identifiantCompteDepense;
	public Boolean pointee;

}

