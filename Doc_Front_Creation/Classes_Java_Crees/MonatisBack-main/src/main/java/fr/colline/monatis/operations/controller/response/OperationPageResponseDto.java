/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\operations\controller\response\OperationPageResponseDto.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\operations\controller\response\OperationPageResponseDto.java
 */
package fr.colline.monatis.operations.controller.response;

import java.io.Serializable;
import java.util.List;

public class OperationPageResponseDto implements Serializable {

	private static final long serialVersionUID = -5070266132579386860L;

	public List<OperationResponseDto> operations;
	public Integer numeroPage;
	public Integer taillePage;
	public Long totalOperations;
	public Integer totalPages;
	public Long premierElement;
	public Long dernierElement;

}

